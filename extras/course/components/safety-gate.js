(function () {
  const TAG = 'safety-gate';
  if (customElements.get(TAG)) return;

  const ACTIONS = [
    ['retry', '같은 상태 변경 호출을 새 키로 즉시 재시도'],
    ['status', '기존 키를 유지하고 외부 상태를 먼저 조회'],
    ['requote', '중단하고 금액을 다시 계산한 뒤 재확인'],
    ['escalate', '증거와 함께 직원에게 이관'],
    ['approval', '직원 승인을 받은 뒤에만 계속'],
    ['reuse-key', '원래 멱등성 키로 기존 처리 결과 조회']
  ];

  const CASES = [
    {
      id: 'timeout',
      title: '환불 생성 직후 네트워크 타임아웃',
      detail: '서버가 요청을 처리했는지는 알 수 없습니다. 새로 호출하면 중복 환불이 생길 수 있습니다.',
      answer: 'status',
      explanation: '결과가 불명확할 때는 생성 호출을 반복하지 말고 환불 상태를 먼저 조회해야 합니다.'
    },
    {
      id: 'duplicate',
      title: '같은 사용자가 환불 버튼을 두 번 누름',
      detail: '두 요청은 같은 주문과 같은 사용자 확인에서 나왔습니다.',
      answer: 'reuse-key',
      explanation: '같은 의도의 재요청에는 같은 멱등성 키를 사용해 하나의 결과만 만들어야 합니다.'
    },
    {
      id: 'mismatch',
      title: '견적은 89,000원인데 실행 요청은 98,000원',
      detail: '사용자가 확인한 금액과 상태 변경 인수가 다릅니다.',
      answer: 'requote',
      explanation: '확인된 금액과 실행 금액이 다르면 즉시 중단하고 견적과 사용자 확인을 다시 받아야 합니다.'
    },
    {
      id: 'policy-down',
      title: '현재 환불 정책 서비스를 사용할 수 없음',
      detail: '캐시에 시행일이 지난 정책만 남아 있어 자격 여부를 확정할 수 없습니다.',
      answer: 'escalate',
      explanation: '자격 근거를 확보할 수 없으므로 자동 실행을 멈추고 확인 가능한 증거와 함께 이관해야 합니다.'
    },
    {
      id: 'high-value',
      title: '환불 견적이 149,000원',
      detail: '정책상 100,000원을 초과하는 환불에는 직원 승인이 필요합니다.',
      answer: 'approval',
      explanation: '모델의 확신과 관계없이 서버 정책이 요구하는 사람의 승인을 통과해야 합니다.'
    }
  ];

  const STYLE = `
    :host{display:block;color:var(--course-text,#20242c);font:15px/1.55 system-ui,sans-serif}*{box-sizing:border-box}
    .box{background:var(--course-surface,#fff);border:1px solid var(--course-border,#d9dde5);border-radius:12px;padding:16px}h3{font-size:1.05rem;margin:0 0 4px}
    .intro{color:var(--course-muted,#5d6675);margin:0 0 12px}label.select{display:block;font-weight:650}select{background:var(--course-surface,#fff);border:1px solid var(--course-border,#d9dde5);border-radius:7px;color:inherit;font:inherit;margin-top:5px;max-width:100%;padding:8px;width:100%}
    .incident{background:var(--course-danger-soft,#fdecec);border-left:4px solid var(--course-danger,#a12828);border-radius:8px;margin:12px 0;padding:10px 12px}.incident strong{display:block}
    fieldset{border:1px solid var(--course-border,#d9dde5);border-radius:8px;margin:0;padding:10px 12px}legend{font-weight:700;padding:0 5px}
    .choice{display:flex;gap:8px;margin:7px 0}.choice input{margin-top:5px}
    button{border:1px solid var(--course-border,#d9dde5);border-radius:7px;cursor:pointer;font:inherit;font-weight:650;margin-top:12px;padding:8px 12px}
    .primary{background:var(--course-accent,#5b4bc4);border-color:var(--course-accent,#5b4bc4);color:#fff}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--course-accent,#5b4bc4);outline-offset:2px}
    .status{border-radius:8px;margin-top:10px;padding:10px 12px}.status:empty{display:none}.ok{background:var(--course-success-soft,#e8f6ed);color:var(--course-success,#176b3a)}.bad{background:var(--course-danger-soft,#fdecec);color:var(--course-danger,#a12828)}
    .progress{color:var(--course-muted,#5d6675);font-size:.85rem;margin-top:8px}
  `;

  class SafetyGate extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.passed = new Set();
    }

    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = 'true';
      const style = document.createElement('style');
      style.textContent = STYLE;
      const box = document.createElement('section');
      box.className = 'box';
      const title = document.createElement('h3');
      title.id = 'safety-title';
      title.textContent = '장애 상황에서 안전한 복구 선택하기';
      box.setAttribute('aria-labelledby', title.id);
      const intro = document.createElement('p');
      intro.className = 'intro';
      intro.textContent = '재시도, 재조회, 중단, 승인, 이관 중 외부 상태를 가장 안전하게 지키는 행동을 고르세요.';
      const selectLabel = document.createElement('label');
      selectLabel.className = 'select';
      selectLabel.textContent = '장애 시나리오';
      this.select = document.createElement('select');
      CASES.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.title;
        this.select.appendChild(option);
      });
      selectLabel.appendChild(this.select);
      this.incident = document.createElement('div');
      this.incident.className = 'incident';
      this.fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '다음 행동';
      this.choices = document.createElement('div');
      this.fieldset.append(legend, this.choices);
      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'primary';
      check.textContent = '복구 전략 확인';
      check.addEventListener('click', () => this.check());
      this.status = document.createElement('div');
      this.status.className = 'status';
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-live', 'polite');
      this.progress = document.createElement('div');
      this.progress.className = 'progress';
      box.append(title, intro, selectLabel, this.incident, this.fieldset, check, this.status, this.progress);
      this.shadowRoot.append(style, box);
      this.select.addEventListener('change', () => this.renderCase());
      this.renderCase();
    }

    renderCase() {
      const item = CASES.find((entry) => entry.id === this.select.value) || CASES[0];
      this.incident.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = item.title;
      const text = document.createElement('span');
      text.textContent = item.detail;
      this.incident.append(strong, text);
      this.choices.replaceChildren();
      ACTIONS.forEach(([id, label]) => {
        const wrapper = document.createElement('label');
        wrapper.className = 'choice';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `safety-${item.id}`;
        input.value = id;
        const copy = document.createElement('span');
        copy.textContent = label;
        wrapper.append(input, copy);
        this.choices.appendChild(wrapper);
      });
      this.status.textContent = '';
      this.status.className = 'status';
      this.updateProgress();
    }

    check() {
      const item = CASES.find((entry) => entry.id === this.select.value);
      const selected = this.choices.querySelector('input:checked');
      if (!selected) {
        this.setStatus('복구 전략을 하나 선택하세요.', false);
        return;
      }
      if (selected.value !== item.answer) {
        this.setStatus('이 행동은 중복 처리나 권한 우회 위험을 남깁니다. 외부 상태를 먼저 확인하거나 안전하게 중단해 보세요.', false);
        return;
      }
      this.passed.add(item.id);
      this.setStatus(item.explanation, true);
      this.updateProgress();
      if (this.passed.size === CASES.length) {
        this.dispatchEvent(new CustomEvent('course-interaction-complete', {
          bubbles: true,
          composed: true,
          detail: { id: TAG, score: 100 }
        }));
      }
    }

    setStatus(message, ok) {
      this.status.textContent = message;
      this.status.className = `status ${ok ? 'ok' : 'bad'}`;
    }

    updateProgress() {
      this.progress.textContent = `안전하게 해결한 시나리오: ${this.passed.size} / ${CASES.length}`;
    }
  }

  customElements.define(TAG, SafetyGate);
})();
