// ФАЙЛ: frontend/assets/components/dropdown.js
// ------------------------------------------------------------
// Кастомный выпадающий список (в нашем стиле).
// Почему не <select>: потому что системный select выглядит по‑разному в разных темах.
// ------------------------------------------------------------

let _openDD = null;

export function initDropdownGlobalClose() {
  // Закрываем выпадашку при клике в пустое место.
  document.addEventListener('click', () => {
    if (_openDD) {
      _openDD.classList.remove('open');
      _openDD = null;
    }
  });
}

export function mkDropdown({ items, value, onChange }) {
  const dd = document.createElement('div');
  dd.className = 'dd';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ddBtn';

  const label = document.createElement('span');
  const chev = document.createElement('span');
  chev.className = 'ddChevron';
  chev.textContent = '▾';
  btn.appendChild(label);
  btn.appendChild(chev);

  const menu = document.createElement('div');
  menu.className = 'ddMenu';
  const scroll = document.createElement('div');
  scroll.className = 'ddScroll';
  menu.appendChild(scroll);

  dd.appendChild(btn);
  dd.appendChild(menu);

  const setItems = newItems => {
    scroll.innerHTML = '';
    (newItems || []).forEach(it => {
      const el = document.createElement('div');
      el.className = 'ddItem';
      el.dataset.value = it.value;
      el.textContent = it.label;
      if (it.value === dd.dataset.value) el.classList.add('on');
      el.onclick = e => {
        e.stopPropagation();
        dd.dataset.value = it.value;
        label.textContent = it.label;
        [...scroll.children].forEach(c => c.classList.toggle('on', c.dataset.value === it.value));
        dd.classList.remove('open');
        _openDD = null;
        onChange && onChange(it.value);
      };
      scroll.appendChild(el);
    });
  };

  const setValue = v => {
    dd.dataset.value = v;
    const found = (items || []).find(x => x.value === v);
    label.textContent = found ? found.label : (v ?? '—');
    [...scroll.children].forEach(c => c.classList.toggle('on', c.dataset.value === v));
  };

  btn.onclick = e => {
    e.stopPropagation();
    if (_openDD && _openDD !== dd) _openDD.classList.remove('open');
    dd.classList.toggle('open');
    _openDD = dd.classList.contains('open') ? dd : null;
  };

  // init
  setItems(items);
  setValue(value);

  // наружу отдаём dd + методы, чтобы можно было менять список моделей
  dd._setItems = setItems;
  dd._setValue = setValue;
  return dd;
}
