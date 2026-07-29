(function () {
  const TAG = 'tool-loop';
  if (customElements.get(TAG)) return;

  const STEPS = [
    {
      expected: 'find_orders',
      prompt: '고객 C-102가 “지난주 받은 이어폰을 환불해 줘”라고 요청했습니다. 먼저 무엇을 해야 할까요?',
      options: [['find_orders', '고객의 최근 주문 조회'], ['create_refund', '즉시 환불 생성'], ['search_policy', '상품을 모른 채 정책 검색']],
      result: 'find_orders → O-1042, 블루투스 이어폰, 89,000원'
    },
    {
      expected: 'get_order',
      prompt: '후보 주문 O-1042를 찾았습니다. 다음 행동은 무엇일까요?',
      options: [['get_order', '주문 상세와 배송 상태 조회'], ['create_refund', '후보 주문을 바로 환불'], ['finish', '주문을 찾았으니 완료 보고']],
      result: 'get_order → 배송 완료 5일 전, 환불 사유 없음'
    },
    {
      expected: 'ask_reason',
      prompt: '주문은 확인했지만 환불 사유가 없습니다. 다음 행동은 무엇일까요?',
      options: [['ask_reason', '사용자에게 환불 사유 질문'], ['quote_refund', '사유 없이 환불액 견적'], ['finish', '환불 불가라고 답변']],
      result: '사용자 응답 → “왼쪽 이어버드가 작동하지 않아요.”'
    },
    {
      expected: 'search_policy',
      prompt: '제품 결함이라는 사유를 확인했습니다. 다음 도구는 무엇일까요?',
      options: [['search_policy', '현재 지역·시행일의 환불 정책 검색'], ['create_refund', '정책 확인 없이 환불 생성'], ['find_orders', '같은 주문을 다시 검색']],
      result: 'search_refund_policy → 제품 결함은 배송 후 30일 이내 환불 가능'
    },
    {
      expected: 'quote_refund',
      prompt: '현재 정책상 환불 대상입니다. 상태를 바꾸기 전에 무엇을 계산해야 할까요?',
      options: [['quote_refund', '정확한 환불액 견적'], ['create_refund', '금액을 추정해 환불'], ['finish', '가능하다고만 답변']],
      result: 'quote_refund → O-1042, 환불 예정액 89,000원'
    },
    {
      expected: 'confirm',
      prompt: '대상과 금액을 계산했습니다. 다음 단계는 무엇일까요?',
      options: [['confirm', '사용자에게 주문과 89,000원 환불 확인 요청'], ['create_refund', '확인 없이 실행'], ['escalate', '모든 환불을 직원에게 이관']],
      result: 'request_user_confirmation → 사용자가 명시적으로 승인'
    },
    {
      expected: 'create_refund',
      prompt: '사용자 확인을 받았습니다. 이제 어떤 호출이 적절할까요?',
      options: [['create_refund', '멱등성 키와 함께 환불 생성'], ['quote_refund', '견적만 계속 반복'], ['finish', '실행하지 않고 완료 보고']],
      result: 'create_refund → R-9001 생성 요청 접수'
    },
    {
      expected: 'get_status',
      prompt: '환불 생성 도구가 R-9001을 반환했습니다. 완료라고 말하기 전에 무엇을 해야 할까요?',
      options: [['get_status', '실제 환불 상태 재조회'], ['create_refund', '확실하도록 한 번 더 생성'], ['finish', '도구 응답만 믿고 완료 보고']],
      result: 'get_refund_status → R-9001, completed, 89,000원'
    }
  ];

  const STYLE = `
    :host{display:block;color:var(--course-text,#20242c);font:15px/1.55 system-ui,sans-serif}*{box-sizing:border-box}
    .box{background:var(--course-surface,#fff);border:1px solid var(--course-border,#d9dde5);border-radius:12px;padding:16px}
    h3{font-size:1.05rem;margin:0 0 4px}.intro{color:var(--course-muted,#5d6675);margin:0 0 14px}
    .step{background:var(--course-surface-soft,#f6f7f9);border-radius:8px;font-weight:650;padding:10px 12px}.options{display:grid;gap:8px;margin-top:10px}
    button{background:var(--course-surface,#fff);border:1px solid var(--course-border,#d9dde5);border-radius:7px;color:inherit;cursor:pointer;font:inherit;padding:9px 11px;text-align:left}
    button:hover{border-color:var(--course-accent,#5b4bc4)}button:focus-visible{outline:3px solid var(--course-accent,#5b4bc4);outline-offset:2px}
    .reset{font-size:.88rem;margin-top:12px}.status{border-radius:8px;margin-top:10px;padding:10px 12px}.status:empty{display:none}
    .ok{background:var(--course-success-soft,#e8f6ed);color:var(--course-success,#176b3a)}.bad{background:var(--course-danger-soft,#fdecec);color:var(--course-danger,#a12828)}
    ol{margin:14px 0 0;padding-left:1.5rem}li{border-left:3px solid var(--course-accent,#5b4bc4);margin:7px 0;padding:3px 8px}
    .counter{color:var(--course-muted,#5d6675);font-size:.85rem;margin-bottom:6px}
  `;

  class ToolLoop extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.index = 0;
    }

    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = 'true';
      const root = this.shadowRoot;
      const style = document.createElement('style');
      style.textContent = STYLE;
      const box = document.createElement('section');
      box.className = 'box';
      const title = document.createElement('h3');
      title.id = 'tool-loop-title';
      title.textContent = '다음 행동 선택하기';
      box.setAttribute('aria-labelledby', title.id);
      const intro = document.createElement('p');
      intro.className = 'intro';
      intro.textContent = '모델의 요청과 도구의 실제 실행을 구분하며 안전한 순서를 완성하세요.';
      this.counter = document.createElement('div');
      this.counter.className = 'counter';
      this.prompt = document.createElement('div');
      this.prompt.className = 'step';
      this.options = document.createElement('div');
      this.options.className = 'options';
      this.status = document.createElement('div');
      this.status.className = 'status';
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-live', 'polite');
      const logTitle = document.createElement('strong');
      logTitle.textContent = '검증된 실행 흔적';
      this.log = document.createElement('ol');
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'reset';
      reset.textContent = '처음부터 다시';
      reset.addEventListener('click', () => this.reset());
      box.append(title, intro, this.counter, this.prompt, this.options, this.status, logTitle, this.log, reset);
      root.append(style, box);
      this.showStep();
    }

    showStep() {
      const step = STEPS[this.index];
      this.options.replaceChildren();
      this.counter.textContent = `단계 ${this.index + 1} / ${STEPS.length}`;
      this.prompt.textContent = step.prompt;
      step.options.forEach(([id, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', () => this.choose(id, label));
        this.options.appendChild(button);
      });
    }

    choose(id, label) {
      const step = STEPS[this.index];
      if (id !== step.expected) {
        this.setStatus(`“${label}”은 아직 이릅니다. 현재 결정에 빠진 관찰이나 검증을 찾아보세요.`, false);
        return;
      }
      const item = document.createElement('li');
      item.textContent = step.result;
      this.log.appendChild(item);
      this.setStatus('좋습니다. 도구 결과를 다음 결정의 관찰로 추가했습니다.', true);
      this.index += 1;
      if (this.index === STEPS.length) {
        this.counter.textContent = `${STEPS.length} / ${STEPS.length}단계 완료`;
        this.prompt.textContent = '외부 상태까지 확인했습니다. 이제 환불 ID와 실제 상태를 사용자에게 보고할 수 있습니다.';
        this.options.replaceChildren();
        this.dispatchEvent(new CustomEvent('course-interaction-complete', {
          bubbles: true,
          composed: true,
          detail: { id: TAG, score: 100 }
        }));
        return;
      }
      this.showStep();
    }

    setStatus(message, ok) {
      this.status.textContent = message;
      this.status.className = `status ${ok ? 'ok' : 'bad'}`;
    }

    reset() {
      this.index = 0;
      this.log.replaceChildren();
      this.status.textContent = '';
      this.status.className = 'status';
      this.showStep();
    }
  }

  customElements.define(TAG, ToolLoop);
})();
