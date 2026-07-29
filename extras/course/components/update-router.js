(function () {
  const TAG = 'update-router';
  if (customElements.get(TAG)) return;

  const ROUTES = [
    ['knowledge', '지식 업데이트', '정책·상품·업무 사실처럼 외부 세계가 바뀐 경우'],
    ['instruction', '지침 업데이트', '절차나 판단 기준이 모호하게 설명된 경우'],
    ['program', '프로그램·하네스 업데이트', '권한, 불변조건, 검증, 재시도처럼 반드시 강제할 규칙'],
    ['model', '모델 업데이트', '컨텍스트와 도구가 충분해도 여러 과업에서 반복되는 역량 부족']
  ];

  const CASES = [
    {
      id: 'stale-policy',
      title: '정확했던 절차가 정책 시행일 변경 뒤 실패함',
      detail: '에이전트는 제공된 정책을 올바르게 적용했지만 정책 파일 자체가 오래됐습니다.',
      answer: 'knowledge',
      explanation: '외부 사실이 바뀌었으므로 현재 정책 자료와 시행일을 갱신하는 것이 가장 작은 수정입니다.'
    },
    {
      id: 'ambiguous-step',
      title: '환불 사유를 언제 물어볼지 매번 다르게 판단함',
      detail: '도구와 정책은 충분하지만 작업 절차에 사유 확인 시점이 명시되지 않았습니다.',
      answer: 'instruction',
      explanation: '절차의 모호함은 지침에 “정책 검색 전에 사유를 확인한다”라고 명시해 해결합니다.'
    },
    {
      id: 'approval-bypass',
      title: '100,000원 초과 환불을 모델이 간혹 바로 실행함',
      detail: '프롬프트에는 승인 규칙이 있지만 상태 변경 API가 이를 강제하지 않습니다.',
      answer: 'program',
      explanation: '권한과 금액 상한은 모델의 준수에 맡기지 말고 서버 코드의 불변조건으로 강제해야 합니다.'
    },
    {
      id: 'general-capability',
      title: '충분한 정보와 명확한 도구가 있어도 새 상품군에서 같은 추론을 반복 실패함',
      detail: '지식·지침·코드 수정과 평가를 먼저 수행했지만 여러 독립 과업에서 일반 역량 부족이 남았습니다.',
      answer: 'model',
      explanation: '더 작은 수정으로 해결되지 않는 반복적 역량 부족일 때만 학습이나 더 적합한 모델을 검토합니다.'
    }
  ];

  const STYLE = `
    :host{display:block;color:var(--course-text,#20242c);font:15px/1.55 system-ui,sans-serif}*{box-sizing:border-box}
    .box{background:var(--course-surface,#fff);border:1px solid var(--course-border,#d9dde5);border-radius:12px;padding:16px}h3{font-size:1.05rem;margin:0 0 4px}
    .intro{color:var(--course-muted,#5d6675);margin:0 0 12px}label.select{display:block;font-weight:650}select{background:var(--course-surface,#fff);border:1px solid var(--course-border,#d9dde5);border-radius:7px;color:inherit;font:inherit;margin-top:5px;max-width:100%;padding:8px;width:100%}
    .case{background:var(--course-surface-soft,#f6f7f9);border-radius:8px;margin:12px 0;padding:10px 12px}.case strong{display:block}
    fieldset{border:0;margin:0;padding:0}legend{font-weight:700;margin-bottom:7px}.routes{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}
    .route{border:1px solid var(--course-border,#d9dde5);border-radius:8px;display:flex;gap:8px;padding:9px}.route:has(input:checked){border-color:var(--course-accent,#5b4bc4);box-shadow:0 0 0 1px var(--course-accent,#5b4bc4)}
    .route input{margin-top:4px}.route strong,.route small{display:block}.route small{color:var(--course-muted,#5d6675);margin-top:2px}
    button{background:var(--course-accent,#5b4bc4);border:1px solid var(--course-accent,#5b4bc4);border-radius:7px;color:#fff;cursor:pointer;font:inherit;font-weight:650;margin-top:12px;padding:8px 12px}
    button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--course-accent,#5b4bc4);outline-offset:2px}.status{border-radius:8px;margin-top:10px;padding:10px}.status:empty{display:none}
    .ok{background:var(--course-success-soft,#e8f6ed);color:var(--course-success,#176b3a)}.bad{background:var(--course-danger-soft,#fdecec);color:var(--course-danger,#a12828)}.progress{color:var(--course-muted,#5d6675);font-size:.85rem;margin-top:8px}
  `;

  class UpdateRouter extends HTMLElement {
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
      title.id = 'router-title';
      title.textContent = '실패를 가장 작은 수정 위치로 보내기';
      box.setAttribute('aria-labelledby', title.id);
      const intro = document.createElement('p');
      intro.className = 'intro';
      intro.textContent = '모든 실패에 모델 학습을 적용하지 말고 원인에 가장 가까운 수정 매체를 선택하세요.';
      const selectLabel = document.createElement('label');
      selectLabel.className = 'select';
      selectLabel.textContent = '실패 사례';
      this.select = document.createElement('select');
      CASES.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.title;
        this.select.appendChild(option);
      });
      selectLabel.appendChild(this.select);
      this.caseBox = document.createElement('div');
      this.caseBox.className = 'case';
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '수정 위치';
      this.routes = document.createElement('div');
      this.routes.className = 'routes';
      fieldset.append(legend, this.routes);
      const check = document.createElement('button');
      check.type = 'button';
      check.textContent = '수정 위치 확인';
      check.addEventListener('click', () => this.check());
      this.status = document.createElement('div');
      this.status.className = 'status';
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-live', 'polite');
      this.progress = document.createElement('div');
      this.progress.className = 'progress';
      box.append(title, intro, selectLabel, this.caseBox, fieldset, check, this.status, this.progress);
      this.shadowRoot.append(style, box);
      this.select.addEventListener('change', () => this.renderCase());
      this.renderCase();
    }

    renderCase() {
      const item = CASES.find((entry) => entry.id === this.select.value) || CASES[0];
      this.caseBox.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = item.title;
      const detail = document.createElement('span');
      detail.textContent = item.detail;
      this.caseBox.append(strong, detail);
      this.routes.replaceChildren();
      ROUTES.forEach(([id, label, help]) => {
        const route = document.createElement('label');
        route.className = 'route';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `route-${item.id}`;
        input.value = id;
        const copy = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = label;
        const note = document.createElement('small');
        note.textContent = help;
        copy.append(name, note);
        route.append(input, copy);
        this.routes.appendChild(route);
      });
      this.status.textContent = '';
      this.status.className = 'status';
      this.progress.textContent = `분류 완료: ${this.passed.size} / ${CASES.length}`;
    }

    check() {
      const item = CASES.find((entry) => entry.id === this.select.value);
      const selected = this.routes.querySelector('input:checked');
      if (!selected) {
        this.setStatus('수정 위치를 하나 선택하세요.', false);
        return;
      }
      if (selected.value !== item.answer) {
        this.setStatus('더 작고 직접적인 수정으로 해결할 수 있는지 먼저 확인해 보세요.', false);
        return;
      }
      this.passed.add(item.id);
      this.setStatus(item.explanation, true);
      this.progress.textContent = `분류 완료: ${this.passed.size} / ${CASES.length}`;
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
  }

  customElements.define(TAG, UpdateRouter);
})();
