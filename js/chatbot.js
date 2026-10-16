/* Asistente informativo de Lombana Therapy: no requiere servicio de IA. */
(() => {
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // Sólo palabras o expresiones completas; evita mapa/mapache y costo/acosto.
  const has = (s, terms) => terms.some(t => (' ' + s + ' ').includes(' ' + t + ' '));
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

  function identifyAll(s, data) {
    if (!data) return [];
    const entries = data.map(t => {
      const name = normalize(t.nombre);
      const slug = normalize((t.slug || '').replace(/-/g, ' '));
      const words = name.split(' ').filter(w => w.length >= 5 &&
        !['masaje', 'masajes', 'terapia', 'terapias', 'sesion', 'sesiones'].includes(w));
      return { t, name, slug, words };
    });
    const matches = entries.filter(e => has(s, [e.name, e.slug]) ||
      e.words.some(w => has(s, [w]) && entries.filter(other => other.words.includes(w)).length === 1));
    // Se admiten abreviaturas sin inventar servicios: sólo coinciden con datos reales.
    for (const [keywords, fragment] of [
      [['reflexo'], 'reflexolog'], [['quiro', 'quiropraxia', 'quiropractico'], 'quiro'],
      [['drenaje'], 'drenaje'], [['aroma'], 'aromaterapia'], [['ventosa', 'ventosas'], 'ventosa']
    ]) {
      if (!has(s, keywords)) continue;
      const found = entries.filter(e => e.name.includes(fragment));
      if (found.length === 1 && !matches.includes(found[0])) matches.push(found[0]);
    }
    return matches.map(e => e.t);
  }
  function withoutNegations(s) {
    return s.replace(
      /\bno\s+(?:quiero|quisiera|deseo|necesito|busco)\s+(?:saber\s+)?(?:el\s+|la\s+|mi\s+|mis\s+|un\s+|una\s+)?(?:cancelar(?:\s+(?:mi|la|una)\s+cita)?|crear(?:\s+una)?\s+cuenta|registrarme|registrar|agendar|reservar|pagar|precio|precios|presio|costo|costos|horarios?)\b/g,
      ' '
    ).replace(/\s+/g, ' ').trim();
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
  async function reply(question, context = {}) {
    const normalized = normalize(question);
    if (!normalized) return { text: 'Escribe una pregunta para ayudarte.' };
    const s = withoutNegations(normalized.replace(
      /^(?:(?:hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)(?:\s+|$))+/,
      ''
    ).trim());
    if (!s && !normalized.startsWith('no ')) return {
      text: '¡Hola! Soy el asistente de Lombana Therapy. Puedo ayudarte con terapias, precios, duración, horarios y citas.',
      links: [item('Ver terapias', 'terapias.html'), item('Agendar cita', 'agendar.html')]
    };
    const homeService = has(s, ['a domicilio','en domicilio']);
    const location = has(s, ['ubicacion','ubicados','direccion','donde estan',
      'donde se encuentran','donde esta lombana','donde esta el consultorio',
      'donde queda','donde quedan','por donde estan','como llegar','como llego','mapa','localizacion'])
      || (has(s, ['domicilio']) && !homeService);
    const contact = has(s, ['whatsapp','whats','wats','watsap','telefono','contacto',
      'numero','celular','llamar','facebook','comunicar','correo','email']);
    const hours = has(s, ['horario','horarios','hora de atencion','a que hora',
      'cuando abren','cuando cierran','dias atienden','que dias','abren','atienden',
      'abiertos','abierto','sabado','sabados','domingo','domingos','disponibilidad',
      'disponibles','horas libres','citas libres','citas disponibles',
      'tienen espacio','hay espacio','hay cupo','tienen cupo','hay lugar',
      'tienen lugar','hay hueco','tienen hueco']);
    const manage = has(s, ['mis citas','mi cita','cancelar','cancelacion','cancelo',
      'reagendar','cambiar mi cita','modificar cita','citas reservadas']);
    const booking = has(s, ['agendar','agenda','reservar','sacar cita','hacer cita',
      'quiero una cita','pedir cita','solicitar cita','tomar cita','registrar una cita',
      'registrar cita','registrar mi cita','crear cita','nueva cita','otra cita','pedir turno','sacar turno']);
    const payment = has(s, ['forma de pago','formas de pago','metodo de pago',
      'metodos de pago','mercado pago','mercadopago','efectivo','tarjeta','transferencia',
      'pagar','pago','pagos','pague','pagado','pagada','cobro','cobrar','cobraron',
      'cobrado','deposito','abono','reembolso','reembolsar','factura']);
    const account = has(s, ['iniciar sesion','inicio de sesion','registrarme','registrar',
      'registro','crear cuenta','crear una cuenta','contrasena','clave','usuario',
      'perfil','no puedo entrar','recuperar cuenta','olvide mi clave','olvide mi contrasena'])
      && !has(s, ['registrar una cita','registrar cita','registrar mi cita']);
    const wantsPrice = has(s, ['precio','precios','presio','presios','costo','costos',
      'cuanto cuesta','cuanto cuestan','cuanto vale','cuanto sale','cuanto cobran',
      'vale','cuesta','cuestan','tarifa','tarifas','pesos','cobran']);
    const wantsDuration = has(s, ['duracion','dura','duran','minutos','tiempo',
      'cuanto tarda','cuanto tardan','cuanto tiempo','cuanto se tarda','tarda']);
    const therapyTopic = has(s, ['terapia','terapias','masaje','masajes','masage','masages',
      'drenaje','reflexo','reflexologia','ventosa','ventosas','quiro',
      'quiropraxia','quiropractico','aromaterapia','servicio','servicios',
      'tratamiento','tratamientos','sesion','sesiones','ofrecen','hacen']);
    const clinical = has(s, ['dolor','lesion','embarazo','fractura','enfermedad','curar',
      'diagnostico','contraindicacion','recomiendan','recomiendas']);
    const citas = has(s, ['cita','citas','sita','sitas','reservacion','reservaciones','turno','turnos']);
    const messages = [], links = [];
    function add(text, actions = []) {
      messages.push(text);
      for (const link of actions) {
        if (!links.some(l => l.text === link.text && l.url === link.url)) links.push(link);
      }
    }
    if (homeService) add('No tengo información publicada que confirme atención a domicilio. Consulta directamente con Lombana Therapy antes de reservar esa modalidad.',
      [item('Contacto','index.html#contacto')]);
    if (location) add('Nos encontramos en Av. del Rosal 30, Los Ángeles, Iztapalapa, 09837, Ciudad de México.',
      [item('Ver ubicación','index.html#ubicacion')]);
    if (contact) add('Puedes contactar a Lombana Therapy por WhatsApp o Facebook desde la sección de contacto. Para otros medios, consulta los datos publicados allí.',
      [item('Ir a contacto','index.html#contacto'),item('WhatsApp','https://wa.me/525611676062')]);
    if (hours) add('El horario de atención de Lombana Therapy es de lunes a viernes de 9:00 a 18:00 h y sábados de 9:00 a 15:00 h. Los domingos no hay atención. La disponibilidad de citas depende de la fecha seleccionada.',
      [item('Ver horarios disponibles','agendar.html')]);
    if (manage) add('Para consultar tus citas, entra a Mis citas. Algunas gestiones pueden requerir iniciar sesión. Si necesitas hacer cambios que no estén disponibles, contacta al consultorio.',
      [item('Mis citas','mis-citas.html'),item('Contacto','index.html#contacto')]);
    if (booking) add('Para agendar, abre Agendar terapia, selecciona una terapia, elige fecha y un horario disponible y confirma la cita.',
      [item('Agendar terapia','agendar.html')]);
    if (payment) {
      const special = has(s, ['transferencia','deposito','factura','reembolso','reembolsar']);
      add(special
        ? 'No puedo confirmar desde el chat si esa modalidad o gestión está disponible. Consulta directamente con Lombana Therapy antes de realizar un pago. No compartas datos bancarios en el chat.'
        : 'En Lombana Therapy puedes reservar sin registrar un cobro, elegir pago pendiente en efectivo en el establecimiento, usar Mercado Pago o una simulación escolar. Los pagos electrónicos deben validarse antes de confirmar la cita. Este chat no puede comprobar pagos ni confirmar citas.',
        [item('Ver opciones de reserva','agendar.html'),...(special ? [item('Contacto','index.html#contacto')] : [])]);
    }
    if (account) add('Puedes iniciar sesión o crear una cuenta desde las páginas correspondientes. Si tienes problemas de acceso, contacta al consultorio. Nunca compartas contraseñas en el chat.',
      [item('Iniciar sesión','login.html'),item('Registrarme','registro.html')]);
    let currentTherapy = null;
    if (wantsPrice || wantsDuration || (therapyTopic && !homeService)) {
      const data = await getTherapies();
      if (!data) add('No pude consultar el catálogo de terapias en este momento. Puedes revisar las terapias en la página o contactar directamente al consultorio. No quiero darte precios sin verificar.',
        [item('Ver terapias','terapias.html'),item('Contacto','index.html#contacto')]);
      else if (!data.length) add('No hay terapias publicadas para consultar en este momento.',
        [item('Ver terapias','terapias.html')]);
      else {
        let selected = identifyAll(s, data);
        const followup = /^(?:(?:y|pero)\s+)?(?:cuanto\s+)?(?:vale|cuesta|dura|tarda)(?:\s+.*)?$/.test(s)
          || has(s, ['y cuanto dura','y cuanto cuesta','y cuanto vale','y el precio','y la duracion']);
        if (!selected.length && (wantsPrice || wantsDuration) && followup && context.therapy) {
          selected = data.filter(t => t.slug === context.therapy);
        }
        if (selected.length) {
          add(selected.map(t => {
            const parts = [t.nombre + '.'];
            if (wantsPrice || wantsDuration) {
              if (wantsPrice) parts.push('Precio: ' + price(t) + '.');
              if (wantsDuration) parts.push(t.duracion_minutos
                ? 'Duración: ' + t.duracion_minutos + ' minutos.' : 'La duración no está publicada.');
            } else {
              if (t.descripcion) parts.push(String(t.descripcion).slice(0,350));
              parts.push('Precio: ' + price(t) + '.');
              if (t.duracion_minutos) parts.push('Duración: ' + t.duracion_minutos + ' minutos.');
            }
            return parts.join(' ');
          }).join(' '), selected.length === 1
            ? [item('Ver detalles','terapia-detalle.html?terapia=' +
                encodeURIComponent(selected[0].slug || normalize(selected[0].nombre).replace(/ /g,'-'))),
                item('Agendar','agendar.html')]
            : [item('Ver todas las terapias','terapias.html'),item('Agendar','agendar.html')]);
          if (selected.length === 1) currentTherapy = selected[0].slug;
        } else {
          const masajes = has(s, ['masaje','masajes','masage','masages']);
          const subset = masajes ? data.filter(t => /masaje/.test(normalize(t.nombre))) : data;
          const options = subset.length ? subset : data;
          if (wantsPrice) add('Estos son los precios publicados: ' +
            options.map(t => t.nombre + ': ' + price(t)).join('; ') + '.',
            [item('Ver todas las terapias','terapias.html')]);
          if (wantsDuration) add('Estas son las duraciones publicadas: ' +
            options.map(t => t.nombre + ': ' +
              (t.duracion_minutos ? t.duracion_minutos + ' minutos' : 'duración no publicada')).join('; ') + '.',
            [item('Ver todas las terapias','terapias.html')]);
          if (!wantsPrice && !wantsDuration) add('Estas son las terapias disponibles' + (masajes ? ' relacionadas con masajes' : '') +
            ': ' + options.map(t => t.nombre).join(', ') +
            '. Puedes preguntarme el precio, la duración o los detalles de una terapia específica.',
            [item('Ver terapias','terapias.html')]);
        }
      }
    }
    if (clinical) add('El chatbot informa sobre servicios publicados, pero no puede diagnosticar, prometer resultados ni determinar qué terapia es adecuada para una condición médica. Consulta a un profesional de salud para una valoración individual.',
      [item('Contacto','index.html#contacto')]);
    if (citas && !hours && !manage && !booking && !payment && !account &&
      !wantsPrice && !wantsDuration && !therapyTopic) {
      add('En Lombana Therapy puedes agendar una cita desde Agendar terapia: selecciona terapia, fecha y un horario disponible. Si ya tienes una cita, entra a Mis citas para consultarla. Los espacios libres se verifican al elegir la fecha en la agenda.',
        [item('Agendar cita','agendar.html'),item('Mis citas','mis-citas.html'),
          item('Ver horarios disponibles','agendar.html')]);
    }
    if (!messages.length) add('Solo puedo responder preguntas referentes a Lombana Therapy: terapias, precios, duración, citas, horarios, pagos, ubicación y contacto. ¿Qué te gustaría consultar?',
      [item('Ver terapias','terapias.html'),item('Agendar cita','agendar.html')]);
    return { text: messages.join('\n\n'), links, therapy: currentTherapy };
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
    let lastTherapy = null;
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
      active = true; busy = false; chatVersion++; lastTherapy = null;
      history.replaceChildren();
      display('¡Hola! Soy el asistente de Lombana Therapy. Puedes preguntarme por terapias, precios, duración, horarios de atención, citas y pagos. No realizo reservas ni cobros por este chat.', 'bot', [item('Ver terapias','terapias.html'), item('Consultar horarios disponibles','agendar.html')]);
      refresh(); input.focus();
    }
    function resetChat() {
      if (!active) return;
      chatVersion++; busy = false; lastTherapy = null; input.value = '';
      history.replaceChildren();
      display('Chat reiniciado. Pregúntame por los servicios de Lombana Therapy.', 'bot', [item('Consultar horarios disponibles','agendar.html')]);
      refresh(); input.focus();
    }
    function finishChat() {
      if (!active) return;
      chatVersion++; active = false; busy = false; lastTherapy = null; input.value = '';
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
        const response = await reply(question, { therapy: lastTherapy });
        if (active && version === chatVersion) {
          lastTherapy = response.therapy || null;
          display(response.text, 'bot', response.links);
        }
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
