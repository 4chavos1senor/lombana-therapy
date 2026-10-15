/* Asistente informativo de Lombana Therapy: no requiere servicio de IA. */
(() => {
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const has = (s, terms) => terms.some(t => s.includes(t));
  const catalog = [
    'masaje relajante', 'drenaje linfatico', 'masaje terapeutico',
    'quiromasaje', 'reflexologia', 'ventosas', 'ajustes quiropracticos', 'aromaterapia'
  ];
  let therapies = null;
  let loading = null;
  async function getTherapies() {
    if (therapies) return therapies;
    if (loading) return loading;
    loading = (async () => {
      if (typeof supabaseClient === 'undefined') return null;
      try {
        const { data, error } = await supabaseClient.from('therapies').select('nombre,slug,precio,duracion_minutos,descripcion,activo').eq('activo', true);
        if (error) throw error;
        therapies = data || [];
        return therapies;
      } catch (error) {
        console.warn('Chatbot: catálogo no disponible', error);
        return null;
      } finally { loading = null; }
    })();
    return loading;
  }
  function identify(s, data) {
    if (!data) return null;
    const entries = data.map(t => ({ t, name: normalize(t.nombre), slug: normalize((t.slug || '').replace(/-/g, ' ')) }));
    return entries.find(({name, slug}) => (name.length > 3 && s.includes(name)) || (slug.length > 3 && s.includes(slug)))?.t ||
      entries.find(({name}) => name.split(' ').filter(w => w.length > 5).some(w => s.includes(w)))?.t || null;
  }
  function price(t) {
    const value = String(t.precio ?? '').trim();
    if (!value) return 'Precio por confirmar con el consultorio';
    const number = value.replace(/\s/g, '').replace(/^\$/, '').replace(/MXN$/i, '').replace(/,/g, '');
    if (/^\d+(?:\.\d{1,2})?$/.test(number) && Number(number) > 0) {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(number));
    }
    // Algunos precios en Supabase son textos descriptivos, no cantidades.
    return value.slice(0, 180);
  }
  const item = (text, url) => ({ text, url });
  async function reply(question) {
    const s = normalize(question);
    if (!s) return { text: 'Escribe una pregunta para ayudarte.' };
    if (has(s, ['hola','buenas','buenos dias','buenas tardes','hey','que tal']) && s.length < 35) return { text: '¡Hola! Soy el asistente de Lombana Therapy. Puedo ayudarte con terapias, precios, duración, horarios y citas.', links: [item('Ver terapias', 'terapias.html'), item('Agendar cita', 'agendar.html')] };
    if (has(s, ['ubicacion','ubicados','direccion','donde estan','donde se encuentran','donde esta lombana','donde esta el consultorio','como llegar','mapa'])) return { text: 'Nos encontramos en Av. del Rosal 30, Los Ángeles, Iztapalapa, 09837, Ciudad de México.', links: [item('Ver ubicación', 'index.html#ubicacion')] };
    if (has(s, ['whatsapp','telefono','contacto','numero','llamar','facebook','comunicar'])) return { text: 'Puedes contactar a Lombana Therapy por WhatsApp o Facebook desde la sección de contacto.', links: [item('Ir a contacto','index.html#contacto'), item('WhatsApp','https://wa.me/525611676062')] };
    if (has(s, ['horario','horarios','hora de atencion','a que hora','cuando abren','cuando cierran','dias atienden','que dias','abren el sabado','atienden domingos','disponibilidad','disponibles','horas libres','citas libres','citas disponibles','tienen espacio'])) return { text: 'El horario de atención de Lombana Therapy es de lunes a viernes de 9:00 a 18:00 h y sábados de 9:00 a 15:00 h. Los domingos no hay atención. La disponibilidad de citas depende de la fecha seleccionada.', links: [item('Ver horarios disponibles', 'agendar.html')] };
    if (has(s, ['mis citas','mi cita','cancelar','reagendar','modificar cita','citas reservadas'])) return { text: 'Para consultar tus citas, entra a Mis citas. Algunas gestiones pueden requerir iniciar sesión. Si necesitas hacer cambios que no estén disponibles, contacta al consultorio.', links: [item('Mis citas', 'mis-citas.html'), item('Contacto', 'index.html#contacto')] };
    if (has(s, ['agendar','reservar','sacar cita','hacer cita','quiero una cita','pedir cita'])) return { text: 'Para agendar, abre Agendar terapia, selecciona una terapia, elige fecha y un horario disponible y confirma la cita.', links: [item('Agendar terapia','agendar.html')] };
    if (has(s, ['forma de pago','formas de pago','metodo de pago','metodos de pago','mercado pago','mercadopago','efectivo','tarjeta','transferencia','pagar','pago en establecimiento'])) return { text: 'En Lombana Therapy puedes reservar sin registrar un cobro, elegir pago pendiente en efectivo en el establecimiento, usar Mercado Pago o una simulación escolar. Los pagos electrónicos deben validarse antes de confirmar la cita. Nunca compartas datos bancarios en el chat.', links: [item('Ver opciones de reserva', 'agendar.html')] };
    if (has(s, ['iniciar sesion','registrarme','registrar','crear cuenta','contrasena','contraseña'])) return { text: 'Puedes iniciar sesión o crear una cuenta desde las páginas correspondientes.', links: [item('Iniciar sesión', 'login.html'), item('Registrarme', 'registro.html')] };
    const wantsInfo = has(s, ['terapia','masaje','drenaje','reflexo','ventosa','quiro','aromaterapia','precio','costo','cuanto cuesta','cuanto vale','cuanto cobran','duracion','dura','minutos','servicio','tratamiento','ofrecen','hacen']);
    if (wantsInfo) {
      const data = await getTherapies();
      const therapy = identify(s, data);
      if (therapy) {
        const slug = therapy.slug || normalize(therapy.nombre).replace(/ /g,'-');
        const answer = [`${therapy.nombre}.`];
        if (has(s,['precio','costo','cuanto cuesta','cuanto vale','cuanto cobran','vale','cuesta','cobran'])) answer.push(`Precio: ${price(therapy)}.`);
        else if (has(s,['duracion','dura','minutos','tiempo'])) answer.push(therapy.duracion_minutos ? `Duración: ${therapy.duracion_minutos} minutos.` : 'La duración no está publicada.');
        else {
          if (therapy.descripcion) answer.push(String(therapy.descripcion).slice(0,350));
          answer.push(`Precio: ${price(therapy)}.`);
          if (therapy.duracion_minutos) answer.push(`Duración: ${therapy.duracion_minutos} minutos.`);
        }
        return { text: answer.join(' '), links: [item('Ver detalles',`terapia-detalle.html?terapia=${encodeURIComponent(slug)}`), item('Agendar','agendar.html')] };
      }
      if (data && data.length) {
        const names = [...new Set(data.map(x => x.nombre).filter(Boolean))];
        if (has(s,['precio','costos','cuanto cuestan','cuanto cuesta','precios'])) return { text: 'Estos son los precios publicados: ' + data.map(t => `${t.nombre}: ${price(t)}`).join('; ') + '.', links: [item('Ver todas las terapias','terapias.html')] };
        return { text: 'Estas son las terapias disponibles: ' + names.join(', ') + '. Puedes preguntarme el precio, la duración o los detalles de una terapia específica.', links: [item('Ver terapias','terapias.html')] };
      }
      return { text: 'No pude consultar el catálogo de terapias en este momento. Puedes revisar las terapias en la página o contactar directamente al consultorio. No quiero darte precios sin verificar.', links: [item('Ver terapias','terapias.html'), item('Contacto','index.html#contacto')] };
    }
    return { text: 'Solo puedo responder preguntas referentes a Lombana Therapy: terapias, precios, duración, citas, horarios, pagos, ubicación y contacto. ¿Qué te gustaría consultar?', links: [item('Ver terapias','terapias.html'), item('Agendar cita','agendar.html')] };
  }
  document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.createElement('aside');
    wrapper.className = 'lt-chat';
    wrapper.innerHTML = `<button class="lt-chat-toggle" type="button" aria-expanded="false" aria-controls="lt-chat-panel" aria-label="Abrir asistente de Lombana Therapy">💬 <span>¿Necesitas ayuda?</span></button>
      <section class="lt-chat-panel" id="lt-chat-panel" aria-label="Chat de ayuda" hidden>
      <header class="lt-chat-head"><div><strong>Asistente Lombana</strong><small>Información de nuestro sitio</small></div><button type="button" class="lt-chat-close" aria-label="Cerrar chat">×</button></header>
      <div class="lt-chat-history" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="lt-chat-controls" aria-label="Control del chat"><button type="button" class="lt-chat-start">Iniciar chat</button><button type="button" class="lt-chat-reset">Reiniciar chat</button><button type="button" class="lt-chat-finish">Finalizar chat</button></div>
      <form class="lt-chat-form"><label class="lt-chat-sr" for="lt-chat-input">Escribe tu pregunta</label><input id="lt-chat-input" type="text" maxlength="400" placeholder="Primero inicia el chat..." autocomplete="off" required disabled><button type="submit" disabled>Enviar</button></form></section>`;
    document.body.appendChild(wrapper);
    const toggle = wrapper.querySelector('.lt-chat-toggle');
    const panel = wrapper.querySelector('.lt-chat-panel');
    const history = wrapper.querySelector('.lt-chat-history');
    const input = wrapper.querySelector('input');
    const send = wrapper.querySelector('.lt-chat-form button');
    const start = wrapper.querySelector('.lt-chat-start');
    const reset = wrapper.querySelector('.lt-chat-reset');
    const finish = wrapper.querySelector('.lt-chat-finish');
    let active = false;
    let busy = false;
    let chatVersion = 0;
    function display(text, who, links) {
      const message = document.createElement('div');
      message.className = `lt-chat-message ${who}`;
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      message.appendChild(paragraph);
      for (const link of links || []) { const a = document.createElement('a'); a.textContent = link.text; a.href = link.url; if (link.url.startsWith('https:')) { a.target='_blank'; a.rel='noopener noreferrer'; } message.appendChild(a); }
      history.appendChild(message);
      history.scrollTop = history.scrollHeight;
    }
    function open(value) {
      panel.hidden = !value;
      toggle.setAttribute('aria-expanded', String(value));
      if (value) (active ? input : start).focus(); else toggle.focus();
    }
    toggle.addEventListener('click', () => open(panel.hidden));
    wrapper.querySelector('.lt-chat-close').addEventListener('click', () => open(false));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) open(false); });
    function refresh() {
      start.disabled = active;
      reset.disabled = !active;
      finish.disabled = !active;
      input.disabled = !active || busy;
      send.disabled = !active || busy;
      input.placeholder = active ? 'Pregunta sobre Lombana Therapy...' : 'Primero inicia el chat...';
    }
    function startChat() {
      if (active) return;
      active = true; busy = false; chatVersion++;
      history.replaceChildren();
      display('¡Hola! Soy el asistente de Lombana Therapy. Puedes preguntarme por terapias, precios, duración, horarios de atención, citas y pagos. No realizo reservas ni cobros por este chat.', 'bot', [item('Ver terapias','terapias.html'), item('Consultar horarios disponibles','agendar.html')]);
      refresh(); input.focus();
    }
    function resetChat() {
      if (!active) return;
      chatVersion++; busy = false; input.value = '';
      history.replaceChildren();
      display('Chat reiniciado. Pregúntame por los servicios de Lombana Therapy.', 'bot', [item('Consultar horarios disponibles','agendar.html')]);
      refresh(); input.focus();
    }
    function finishChat() {
      if (!active) return;
      chatVersion++; active = false; busy = false; input.value = '';
      history.replaceChildren();
      display('Chat finalizado. Gracias por comunicarte con Lombana Therapy. Pulsa «Iniciar chat» para comenzar otra conversación.', 'bot');
      refresh(); start.focus();
    }
    async function ask(question) {
      if (!active || busy || !question.trim()) return;
      const version = chatVersion;
      display(question,'user');
      busy = true; refresh();
      try {
        const response = await reply(question);
        if (active && version === chatVersion) display(response.text, 'bot', response.links);
      } catch {
        if (active && version === chatVersion) display('No pude responder en este momento. Intenta nuevamente o consulta la sección de contacto.', 'bot', [item('Contacto','index.html#contacto')]);
      } finally {
        if (version === chatVersion) {
          busy = false; refresh();
          if (active && !panel.hidden) input.focus();
        }
      }
    }
    start.addEventListener('click',startChat);
    reset.addEventListener('click',resetChat);
    finish.addEventListener('click',finishChat);
    wrapper.querySelector('.lt-chat-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!active || busy) return;
      const value=input.value.trim();
      if (!value) return;
      input.value='';
      void ask(value);
    });
    display('Bienvenido al asistente de Lombana Therapy. Pulsa «Iniciar chat» para comenzar.', 'bot');
    refresh();
  });
})();
