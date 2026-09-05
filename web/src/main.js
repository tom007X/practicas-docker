import './style.css';

// Un solo front (Vite) para las 5 APIs. Todas las llamadas van a "/api/<servicio>/..."
// -> en produccion NGINX reenvia cada prefijo al contenedor que corresponde (ver nginx.conf);
// en desarrollo lo hace el proxy de Vite (ver vite.config.js).
const ENTIDADES = [
  {
    key: 'clientes',
    titulo: 'Clientes',
    campos: [
      { name: 'nombre', label: 'Nombre', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'dni', label: 'DNI', type: 'text' },
    ],
  },
  {
    key: 'pagos',
    titulo: 'Pagos',
    campos: [
      { name: 'monto_ars', label: 'Monto (ARS)', type: 'number' },
      { name: 'medio_pago', label: 'Medio de pago', type: 'text' },
    ],
    soloLectura: ['monto_usd'],
  },
  {
    key: 'facturas',
    titulo: 'Facturas',
    campos: [
      { name: 'numero', label: 'Numero', type: 'text' },
      { name: 'monto', label: 'Monto', type: 'number' },
      { name: 'clienteId', label: 'ID Cliente', type: 'number' },
      { name: 'fechaEmision', label: 'Fecha emision', type: 'date' },
    ],
  },
  {
    key: 'transacciones',
    titulo: 'Transacciones',
    campos: [
      { name: 'origen_ip', label: 'IP de origen', type: 'text' },
      { name: 'monto', label: 'Monto', type: 'number' },
      { name: 'tipo', label: 'Tipo', type: 'text' },
    ],
    soloLectura: ['pais'],
  },
  {
    key: 'tarjetas',
    titulo: 'Tarjetas',
    campos: [
      { name: 'alias', label: 'Alias', type: 'text' },
      { name: 'titular', label: 'Titular', type: 'text' },
      { name: 'tipo', label: 'Tipo (credito/debito)', type: 'text' },
      { name: 'limite', label: 'Limite', type: 'number' },
    ],
  },
];

const app = document.querySelector('#app');

function crearNav() {
  const nav = document.createElement('nav');
  ENTIDADES.forEach((entidad, i) => {
    const btn = document.createElement('button');
    btn.textContent = entidad.titulo;
    btn.dataset.key = entidad.key;
    if (i === 0) btn.classList.add('activo');
    btn.addEventListener('click', () => mostrarSeccion(entidad.key));
    nav.appendChild(btn);
  });
  return nav;
}

function mostrarSeccion(key) {
  document.querySelectorAll('main section').forEach((s) => {
    s.hidden = s.dataset.key !== key;
  });
  document.querySelectorAll('nav button').forEach((b) => {
    b.classList.toggle('activo', b.dataset.key === key);
  });
}

function crearSeccion(entidad) {
  const section = document.createElement('section');
  section.dataset.key = entidad.key;
  section.hidden = entidad.key !== ENTIDADES[0].key;

  const h2 = document.createElement('h2');
  h2.textContent = entidad.titulo;
  section.appendChild(h2);

  const form = document.createElement('form');
  entidad.campos.forEach((campo) => {
    const input = document.createElement('input');
    input.type = campo.type;
    input.name = campo.name;
    input.placeholder = campo.label;
    input.required = true;
    form.appendChild(input);
  });
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Agregar';
  form.appendChild(submit);
  section.appendChild(form);

  const columnas = ['id', ...entidad.campos.map((c) => c.name), ...(entidad.soloLectura || [])];

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  [...columnas, ''].forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  section.appendChild(table);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form).entries());
    entidad.campos.forEach((campo) => {
      if (campo.type === 'number') datos[campo.name] = Number(datos[campo.name]);
    });
    await fetch(`/api/${entidad.key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    form.reset();
    cargar(entidad, tbody, columnas);
  });

  cargar(entidad, tbody, columnas);
  return section;
}

async function cargar(entidad, tbody, columnas) {
  const res = await fetch(`/api/${entidad.key}`);
  const items = await res.json();
  tbody.replaceChildren();
  items.forEach((item) => {
    const tr = document.createElement('tr');
    columnas.forEach((col) => {
      const td = document.createElement('td');
      td.textContent = item[col] ?? '';
      tr.appendChild(td);
    });
    const tdBorrar = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Borrar';
    btn.addEventListener('click', async () => {
      await fetch(`/api/${entidad.key}/${item.id}`, { method: 'DELETE' });
      cargar(entidad, tbody, columnas);
    });
    tdBorrar.appendChild(btn);
    tr.appendChild(tdBorrar);
    tbody.appendChild(tr);
  });
}

function render() {
  const header = document.createElement('h1');
  header.textContent = 'FinTech Nova — Panel de Microservicios';
  app.appendChild(header);
  app.appendChild(crearNav());
  const main = document.createElement('main');
  ENTIDADES.forEach((entidad) => main.appendChild(crearSeccion(entidad)));
  app.appendChild(main);
}

render();
