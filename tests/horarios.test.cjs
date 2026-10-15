const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seSuperponen } = require('../js/horarios-solapados.js');
const h = (hora_inicio, hora_fin) => ({hora_inicio,hora_fin});
test('Dos horarios iguales se superponen', () => assert.equal(seSuperponen(h('11:00:00','12:00:00'),h('11:00','12:00')),true));
test('11:00-12:00 y 11:30-12:30 se superponen', () => assert.equal(seSuperponen(h('11:00','12:00'),h('11:30','12:30')),true));
test('11:00-12:00 y 12:00-13:00 NO se superponen', () => assert.equal(seSuperponen(h('11:00','12:00'),h('12:00','13:00')),false));
test('Horas totalmente distintas no se superponen', () => assert.equal(seSuperponen(h('11:00','12:00'),h('13:00','14:00')),false));
test('Horas invalidas se tratan como ocupadas', () => assert.equal(seSuperponen(h('??','12:00'),h('13:00','14:00')),true));
