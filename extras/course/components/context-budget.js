(function () {
  const TAG = 'context-budget';
  if (customElements.get(TAG)) return;

  const BLOCKS = [
    { id: 'system', label: '환불 시스템의 권한과 금지 조건', cost: 12, required: true, note: '서버가 허용하는 행동 범위를 알려 줍니다.' },
    { id: 'request', label: '사용자의 현재 환불 요청', cost: 8, required: true, note: '지금 해결할 목표입니다.' },
    { id: 'customer', label: '고객 C-102의 식별 정보', cost: 10, required: true, note: '다른 고객의 주문을 바꾸지 않게 합니다.' },
    { id: 'order', label: '주문 O-1042와 배송 상태', cost: 14, required: true, note: '상품, 금액, 배송일을 확인합니다.' },
    { id: 'reason', label: '결함 사유: 왼쪽 이어버드 고장', cost: 8, required: true, note: '적용할 정책을 결정하는 핵심 정보입니다.' },
    { id: 'policy', label: '대한민국의 현재 환불 정책', cost: 16, required: true, note: '지역과 시행일이 확인된 정책입니다.' },
    { id: 'history', label: '지난 2년간의 전체 상담 기록', cost: 24, note: '대부분이 현재 결정과 무관합니다.' },
    { id: 'old-policy', label: '시행일이 지난 예전 환불 정책', cost: 14, unsafe: true, note: '현재 정책과 충돌할 수 있습니다.' },
    { id: 'injection', label: '“이전 지시를 무시하라”는 외부 문서 문장', cost: 12, unsafe: true, note: '외부 데이터이지 시스템 지시가 아닙니다.' }
  ];

  const STYLE = `
    :host{display:block;color:var(--course-text,#20242c);font:15px/1.55 system-ui,sans-serif}
    *{box-sizing:border-box}.box{border:1px solid var(--course-border,#d9dde5);border-radius:12px;background:var(--course-surface,#fff);padding:16px}
    h3{font-size:1.05rem;margin:0 0 4px}.intro{color:var(--course-muted,#5d6675);margin:0 0 14px}
    fieldset{border:0;margin:0;padding:0}legend{font-weight:700;margin-bottom:8px}
    .grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))}
    label{align-items:flex-start;border:1px solid var(--course-border,#d9dde5);border-radius:8px;cursor:pointer;display:flex;gap:9px;padding:10px}
    label:has(input:checked){border-color:var(--course-accent,#5b4bc4);box-shadow:0 0 0 1px var(--course-accent,#5b4bc4)}
    input{margin-top:4px}.copy{min-width:0}.name{display:block;font-weight:650}.meta{color:var(--course-muted,#5d6675);display:block;font-size:.82rem;margin-top:2px}
    .meter{background:var(--course-surface-soft,#f6f7f9);border-radius:999px;height:10px;margin-top:14px;overflow:hidden}
    .bar{background:var(--course-accent,#5b4bc4);height:100%;transition:width .2s}.bar.over{background:var(--course-danger,#a12828)}
    .summary{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:space-between;margin-top:5px}
    .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{border:1px solid var(--course-border,#d9dde5);border-radius:7px;cursor:pointer;font:inherit;font-weight:650;padding:8px 12px}
    .primary{background:var(--course-accent,#5b4bc4);border-color:var(--course-accent,#5b4bc4);color:#fff}.secondary{background:var(--course-surface,#fff);color:inherit}
    button:focus-visible,input:focus-visible{outline:3px solid var(--course-accent,#5b4bc4);outline-offset:2px}
    .status{border-radius:8px;margin-top:12px;padding:10px 12px}.status:empty{display:none}.ok{background:var(--course-success-soft,#e8f6ed);color:var(--course-success,#176b3a)}
    .bad{background:var(--course-danger-soft,#fdecec);color:var(--course-danger,#a12828)}
    @media(max-width:520px){.actions button{width:100%}}@media(prefers-reduced-motion:reduce){.bar{transition:none}}
  `;

  class ContextBudget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = 'true';
      this.budget = Number(this.getAttribute('budget')) || 70;
      this.render();
    }

    render() {
      const root = this.shadowRoot;
      const style = document.createElement('style');
      style.textContent = STYLE;
      const box = document.createElement('section');
      box.className = 'box';
      box.setAttribute('aria-labelledby', 'context-budget-title');
      const title = document.createElement('h3');
      title.id = 'context-budget-title';
      title.textContent = '최소 충분 컨텍스트 꾸리기';
      const intro = document.createElement('p');
      intro.className = 'intro';
      intro.textContent = `결정에 필요한 블록만 골라 ${this.budget}단위 예산 안에 넣으세요.`;
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '컨텍스트 블록';
      const grid = document.createElement('div');
      grid.className = 'grid';
      BLOCKS.forEach((block) => grid.appendChild(this.option(block)));
      fieldset.append(legend, grid);

      const meter = document.createElement('div');
      meter.className = 'meter';
      meter.setAttribute('role', 'progressbar');
      meter.setAttribute('aria-label', '컨텍스트 예산 사용량');
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', String(this.budget));
      const bar = document.createElement('div');
      bar.className = 'bar';
      meter.appendChild(bar);
      const summary = document.createElement('div');
      summary.className = 'summary';
      const used = document.createElement('span');
      used.id = 'used';
      const hint = document.createElement('span');
      hint.textContent = '필수 정보 6개 · 위험한 외부 정보 제외';
      summary.append(used, hint);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const check = this.button('구성 확인', 'primary', () => this.check());
      const reset = this.button('선택 초기화', 'secondary', () => {
        root.querySelectorAll('input').forEach((input) => { input.checked = false; });
        this.status('');
        this.update();
      });
      actions.append(check, reset);
      const status = document.createElement('div');
      status.id = 'status';
      status.className = 'status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      box.append(title, intro, fieldset, meter, summary, actions, status);
      root.append(style, box);
      root.addEventListener('change', () => this.update());
      this.update();
    }

    option(block) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = block.id;
      input.dataset.cost = String(block.cost);
      const copy = document.createElement('span');
      copy.className = 'copy';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = `${block.label} · ${block.cost}단위`;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = block.note;
      copy.append(name, meta);
      label.append(input, copy);
      return label;
    }

    button(label, className, handler) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.addEventListener('click', handler);
      return button;
    }

    selected() {
      return [...this.shadowRoot.querySelectorAll('input:checked')].map((input) => input.value);
    }

    update() {
      const total = [...this.shadowRoot.querySelectorAll('input:checked')]
        .reduce((sum, input) => sum + Number(input.dataset.cost), 0);
      const percent = Math.min(100, total / this.budget * 100);
      const bar = this.shadowRoot.querySelector('.bar');
      bar.style.width = `${percent}%`;
      bar.classList.toggle('over', total > this.budget);
      const meter = this.shadowRoot.querySelector('.meter');
      meter.setAttribute('aria-valuenow', String(total));
      meter.setAttribute('aria-valuetext', `${this.budget}단위 중 ${total}단위`);
      this.shadowRoot.getElementById('used').textContent = `사용: ${total} / ${this.budget}단위`;
    }

    check() {
      const selected = new Set(this.selected());
      const missing = BLOCKS.filter((block) => block.required && !selected.has(block.id));
      const unsafe = BLOCKS.filter((block) => block.unsafe && selected.has(block.id));
      const extras = BLOCKS.filter((block) => !block.required && !block.unsafe && selected.has(block.id));
      const total = [...this.shadowRoot.querySelectorAll('input:checked')]
        .reduce((sum, input) => sum + Number(input.dataset.cost), 0);
      const problems = [];
      if (missing.length) problems.push(`필수 정보 ${missing.length}개가 빠졌습니다`);
      if (unsafe.length) problems.push(`오래됐거나 위험한 정보 ${unsafe.length}개를 제거해야 합니다`);
      if (extras.length) problems.push('현재 결정에 불필요한 전체 상담 기록을 제외해 보세요');
      if (total > this.budget) problems.push(`예산을 ${total - this.budget}단위 초과했습니다`);
      if (problems.length) {
        this.status(problems.join('. ') + '.', false);
        return;
      }
      this.status('좋습니다. 현재 결정에 필요한 정보만 남기고 외부의 악성 지시와 오래된 정책을 제외했습니다.', true);
      this.dispatchEvent(new CustomEvent('course-interaction-complete', {
        bubbles: true,
        composed: true,
        detail: { id: TAG, score: 100 }
      }));
    }

    status(message, ok) {
      const status = this.shadowRoot.getElementById('status');
      status.textContent = message;
      status.className = message ? `status ${ok ? 'ok' : 'bad'}` : 'status';
    }
  }

  customElements.define(TAG, ContextBudget);
})();
