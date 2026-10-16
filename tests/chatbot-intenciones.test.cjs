'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filepath = path.join(__dirname, '..', 'js', 'chatbot.js');
const original = fs.readFileSync(filepath, 'utf8');
const marker = "  document.addEventListener('DOMContentLoaded', () => {";
assert.ok(original.includes(marker), 'No se pudo aislar el respondedor del chatbot');

const therapies = [
  { nombre: 'Masaje relajante', slug: 'masaje-relajante',
    precio: '400', duracion_minutos: 60, descripcion: 'Masaje de relajación.' },
  { nombre: 'Drenaje linfático', slug: 'drenaje-linfatico',
    precio: 'Precio a consultar', duracion_minutos: 45, descripcion: 'Drenaje.' },
  { nombre: 'Masaje terapéutico', slug: 'masaje-terapeutico',
    precio: '600', duracion_minutos: 50, descripcion: 'Masaje terapéutico.' }
];
const sandbox = {
  document: { addEventListener() {} },
  supabaseClient: {
    from() {
      return { select() {
        return { eq() { return Promise.resolve({ data: therapies, error: null }); } };
      } };
    }
  },
  console
};
vm.runInNewContext(
  original.replace(marker, '  globalThis.testChatbotReply = reply;\n' + marker),
  sandbox, { filename: 'chatbot.js' }
);
const reply = sandbox.testChatbotReply;

test('palabras solas citas, cita y error ortográfico sitas son reconocidos', async () => {
  for (const question of ['citas', 'CITA', 'sitas', 'Hola, citas', 'reservaciones']) {
    const answer = await reply(question);
    assert.match(answer.text, /agendar una cita/i, question);
    assert.ok(answer.links.some(x => x.url === 'agendar.html'), question);
    assert.ok(answer.links.some(x => x.url === 'mis-citas.html'), question);
  }
});

test('distingue gestión de mis citas y agendar cita', async () => {
  assert.match((await reply('mis citas')).text, /consultar tus citas/i);
  assert.match((await reply('quiero agendar')).text, /Para agendar/i);
  assert.match((await reply('registrar una cita')).text, /Para agendar/i);
});

test('horario de atención y enlace a disponibilidad siguen presentes', async () => {
  for (const question of ['horarios de atención', 'citas disponibles', 'hola, que dias atienden']) {
    const answer = await reply(question);
    assert.match(answer.text, /lunes a viernes de 9:00 a 18:00/i);
    assert.ok(answer.links.some(x => x.url === 'agendar.html' && /horarios disponibles/i.test(x.text)));
  }
});

test('precio y duración se responden juntos cuando ambas se solicitan', async () => {
  const answer = await reply('precio y duración del masaje relajante');
  assert.match(answer.text, /Precio:.*400/);
  assert.match(answer.text, /Duración: 60 minutos/);
});

test('cuánto dura una terapia no se interpreta como pregunta de precio', async () => {
  const answer = await reply('cuánto dura el masaje relajante');
  assert.match(answer.text, /Duración: 60 minutos/);
  assert.doesNotMatch(answer.text, /Precio:/);
});

test('no inventa precio descriptivo ni responde temas ajenos', async () => {
  assert.match((await reply('precio del drenaje linfático')).text, /Precio a consultar/);
  assert.match((await reply('capacitacion')).text, /Solo puedo responder preguntas referentes a Lombana Therapy/i);
});


test('pagos, WhatsApp abreviado y consultas de apertura', async () => {
  assert.match((await reply('pago')).text, /Mercado Pago/);
  assert.match((await reply('¿Tienen Whats?')).text, /WhatsApp/);
  const hours = await reply('¿Abren hoy?');
  assert.match(hours.text, /lunes a viernes de 9:00 a 18:00/);
  assert.ok(hours.links.some(x => x.text === 'Ver horarios disponibles'));
});

test('no reconoce coincidencias dentro de otras palabras', async () => {
  for (const q of ['¿Qué es un mapache?', '¿Qué significa antihorario?', '¿Cómo propagar una planta?']) {
    assert.match((await reply(q)).text, /Solo puedo responder preguntas referentes/i, q);
  }
});

test('multi-intenciones, negaciones y precios genéricos', async () => {
  const a = await reply('¿Dónde están y cuáles son sus horarios?');
  assert.match(a.text, /Av. del Rosal/);
  assert.match(a.text, /lunes a viernes/);
  const b = await reply('No quiero cancelar, quiero agendar.');
  assert.match(b.text, /Para agendar/);
  assert.doesNotMatch(b.text, /consultar tus citas/);
  const c = await reply('No quiero saber el precio, quiero saber cuánto dura el masaje relajante');
  assert.match(c.text, /Duración: 60 minutos/);
  assert.doesNotMatch(c.text, /Precio:/);
  assert.match((await reply('¿Cuánto vale?')).text, /Estos son los precios publicados/);
});

test('no elige arbitrariamente un masaje y reconoce dos terapias', async () => {
  const all = await reply('¿Qué masajes tienen?');
  assert.match(all.text, /Masaje relajante/);
  assert.match(all.text, /Masaje terapéutico/);
  assert.doesNotMatch(all.text, /Drenaje linfático/);
  const both = await reply('¿Cuánto cuesta el masaje relajante y el terapéutico?');
  assert.match(both.text, /Masaje relajante/);
  assert.match(both.text, /Masaje terapéutico/);
  assert.match(both.text, /400/);
  assert.match(both.text, /600/);
});

test('seguimiento de terapia sin inventar precio ni validar pagos', async () => {
  const first = await reply('¿Cuánto cuesta el masaje relajante?');
  assert.match((await reply('¿Y cuánto dura?', { therapy: first.therapy })).text, /Duración: 60 minutos/);
  assert.match((await reply('Ya pagué, ¿está confirmada mi cita?')).text, /no puede comprobar pagos/);
});


test('precio y duración genéricos se responden juntos, sin inventar servicio a domicilio', async () => {
  const both = await reply('¿Qué precio y duración tienen?');
  assert.match(both.text, /Estos son los precios publicados/);
  assert.match(both.text, /Estas son las duraciones publicadas/);
  const home = await reply('¿Ofrecen terapias a domicilio?');
  assert.match(home.text, /No tengo información publicada que confirme atención a domicilio/);
  assert.doesNotMatch(home.text, /Nos encontramos en Av. del Rosal/);
  assert.match((await reply('domicilio')).text, /Av. del Rosal/);
});
