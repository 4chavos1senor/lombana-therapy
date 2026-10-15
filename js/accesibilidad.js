(() => {
  const root = document.documentElement;

  const defaults = {
    theme: "light",
    contrast: "normal",
    scale: 1
  };

  let prefs = { ...defaults };

  // Recuperar preferencias.
  try {
    const saved = JSON.parse(
      localStorage.getItem("lombana-a11y") || "{}"
    );

    prefs.theme = ["light", "dark"].includes(saved.theme)
      ? saved.theme
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    prefs.contrast =
      saved.contrast === "high" ? "high" : "normal";

    prefs.scale = [1, 1.25, 1.5, 1.75, 2].includes(saved.scale)
      ? saved.scale
      : 1;
  } catch {
    // Las opciones funcionan aunque no se puedan guardar.
  }

  function apply() {
    root.dataset.theme = prefs.theme;
    root.dataset.contrast = prefs.contrast;
    root.dataset.scale = String(prefs.scale);
    root.style.setProperty("--a-scale", prefs.scale);

    try {
      localStorage.setItem(
        "lombana-a11y",
        JSON.stringify(prefs)
      );
    } catch {
      // No impide usar el panel.
    }
  }

  apply();

  document.addEventListener("DOMContentLoaded", () => {
    const panel = document.createElement("details");

    panel.className = "a11y-panel";
    panel.id = "accesibilidad";

    panel.innerHTML = `
      <summary aria-label="Abrir menú de accesibilidad" title="Accesibilidad"><img class="a11y-icon" src="assets/img/accesibilidad.svg" alt="" width="30" height="30"><span class="a11y-burger" aria-hidden="true"><i></i><i></i><i></i></span></summary>

      <div class="a11y-dropdown">
        <strong class="a11y-dropdown-title">Accesibilidad</strong>

      <div class="a11y-controls">
        <button
          type="button"
          id="a-night"
          aria-pressed="false"
        >
          Modo nocturno
        </button>

        <button
          type="button"
          id="a-contrast"
          aria-pressed="false"
        >
          Alto contraste
        </button>

        <label for="a-size">Tamaño de texto</label>

        <select id="a-size">
          <option value="1">100%</option>
          <option value="1.25">125%</option>
          <option value="1.5">150%</option>
          <option value="1.75">175%</option>
          <option value="2">200%</option>
        </select>

        <button type="button" id="a-reader" aria-pressed="false" aria-describedby="a-reader-help">Lectura</button>
        <span id="a-reader-help" class="a11y-sr-only">Lee opciones al pasar el cursor o navegar con Tab.</span>
        <button type="button" id="a-reset">
          Restablecer
        </button>

        <button
          type="button"
          id="a-voice"
          aria-pressed="false"
          aria-describedby="a-privacy"
        >
          Activar voz
        </button>
      </div>

      <span id="a-privacy" class="a11y-sr-only">El micrófono se activa únicamente al pulsar Activar voz. El navegador puede procesar el audio para reconocer comandos.</span>

      <p
        class="a11y-caption"
        id="a-caption"
        hidden
        aria-live="off"
      >
        Transcripción: micrófono apagado.
      </p>

      <p
        id="a-feedback"
        role="status"
        aria-live="polite"
      ></p>
      </div>
    `;

    const header = document.querySelector("header");

    if (header) {
      header.after(panel);
    } else {
      document.querySelector("main")?.before(panel);
    }

    const get = (id) => document.getElementById(id);

    function feedback(message) {
      get("a-feedback").textContent = message;
    }

    function refresh() {
      apply();

      get("a-night").setAttribute(
        "aria-pressed",
        String(prefs.theme === "dark")
      );

      get("a-contrast").setAttribute(
        "aria-pressed",
        String(prefs.contrast === "high")
      );

      get("a-size").value = String(prefs.scale);
    }

    get("a-night").onclick = () => {
      prefs.theme =
        prefs.theme === "dark" ? "light" : "dark";
      refresh();
    };

    get("a-contrast").onclick = () => {
      prefs.contrast =
        prefs.contrast === "high" ? "normal" : "high";
      refresh();
    };

    get("a-size").onchange = (event) => {
      prefs.scale = Number(event.target.value);
      refresh();
    };

    get("a-reset").onclick = () => {
      setReader(false);
      recognition?.abort();
      prefs = { ...defaults };
      refresh();
      feedback("Preferencias restablecidas.");
    };

    refresh();

    const synth = window.speechSynthesis;
    let readerEnabled = false;
    let readerTimer;
    let readerTarget = null;
    const readable = 'a, button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [tabindex], label, h1, h2, h3, h4, h5, h6, p, li, td, th, img[alt], [data-read-aloud]';

    function stopReading() {
      clearTimeout(readerTimer);
      readerTarget = null;
      synth?.cancel();
    }

    function speak(text) {
      if (!synth || !text) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 1800));
      const voices = synth.getVoices();
      utterance.voice = voices.find(v => /^es[-_]MX$/i.test(v.lang)) || voices.find(v => /^es/i.test(v.lang)) || null;
      utterance.lang = utterance.voice?.lang || 'es-MX';
      utterance.rate = 1;
      synth.speak(utterance);
    }

    function setReader(enabled) {
      readerEnabled = enabled;
      stopReading();
      get('a-reader').setAttribute('aria-pressed', String(enabled));
      get('a-reader').textContent = enabled ? 'Detener lectura' : 'Lectura';
      feedback(enabled ? 'Lectura activada. Pasa el cursor sobre una opción o usa Tab.' : 'Lectura desactivada.');
    }

    function readingText(el) {
      if (el.matches('input, select, textarea')) {
        const label = el.getAttribute('aria-label') || Array.from(el.labels || []).map(l => l.textContent).join(' ') || el.placeholder || el.name || 'Campo de formulario';
        return label + (el.required ? '. Obligatorio.' : '');
      }
      const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
      return el.getAttribute('data-read-aloud') || el.getAttribute('aria-label') || labelled || el.innerText || el.getAttribute('alt') || el.title || '';
    }

    function scheduleReading(event) {
      if (!readerEnabled || event.pointerType === 'touch') return;
      const el = event.target.closest?.(readable);
      if (!el || el.closest('[aria-hidden="true"], [hidden], [inert]') || el === readerTarget) return;
      stopReading();
      readerTarget = el;
      readerTimer = setTimeout(() => {
        if (readerEnabled && el.isConnected) speak(readingText(el).replace(/\s+/g, ' ').trim());
      }, event.type === 'focusin' ? 100 : 350);
    }

    get('a-reader').onclick = () => {
      if (listening) recognition?.abort();
      setReader(!readerEnabled);
      if (readerEnabled) speak('Lectura activada. Pasa el cursor sobre una opción o usa la tecla Tab.');
    };
    if (!synth || !window.SpeechSynthesisUtterance) {
      get('a-reader').disabled = true;
      get('a-reader-help').textContent = 'Este navegador no ofrece lectura por voz.';
    }
    document.addEventListener('pointerover', scheduleReading);
    document.addEventListener('focusin', scheduleReading);
    document.addEventListener('pointerout', event => {
      if (readerTarget && !readerTarget.contains(event.relatedTarget)) stopReading();
    });
    document.addEventListener('focusout', stopReading);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { stopReading(); panel.open = false; }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopReading(); });
    window.addEventListener('pagehide', stopReading);

    function normalize(text) {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s%]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const routes = {
      inicio: "index.html",
      terapias: "terapias.html",
      agendar: "agendar.html",
      "agendar terapia": "agendar.html",
      "mis citas": "mis-citas.html",
      contacto: "index.html#contacto",
      ubicacion: "index.html#ubicacion",
      "iniciar sesion": "login.html",
      registro: "registro.html"
    };

    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    let recognition;
    let listening = false;
    let failed = false;

    function voiceState(on) {
      listening = on;
      get("a-caption").hidden = !on;
      if (!on) get("a-caption").textContent = "Transcripción: micrófono apagado.";

      get("a-voice").setAttribute(
        "aria-pressed",
        String(on)
      );

      get("a-voice").textContent =
        on ? "Detener voz" : "Activar voz";
    }

    function command(raw) {
      const text = normalize(raw).replace(
        /^(ir a|abrir|ver) /,
        ""
      );

      if (Object.hasOwn(routes, text)) {
        feedback("Abriendo " + text + ".");
        recognition?.stop();
        window.location.href = routes[text];
        return;
      }

      switch (text) {
        case "modo nocturno":
          prefs.theme = "dark";
          break;

        case "modo claro":
          prefs.theme = "light";
          break;

        case "alto contraste":
          prefs.contrast = "high";
          break;

        case "contraste normal":
          prefs.contrast = "normal";
          break;

        case "texto 200 por ciento":
        case "texto doscientos por ciento":
        case "texto 200%":
          prefs.scale = 2;
          break;

        case "texto normal":
          prefs.scale = 1;
          break;

        case "subir":
          window.scrollBy(
            0,
            -window.innerHeight * 0.7
          );
          feedback("Subiendo.");
          return;

        case "bajar":
          window.scrollBy(
            0,
            window.innerHeight * 0.7
          );
          feedback("Bajando.");
          return;

        case "detener voz":
          recognition?.stop();
          feedback("Micrófono apagado.");
          return;

        default:
          feedback(
            "Comando no reconocido. Consulta la lista de comandos."
          );
          return;
      }

      refresh();
      feedback("Aplicado: " + raw);
    }

    if (!Recognition) {
      get("a-voice").disabled = true;

      feedback(
        "Este navegador no ofrece reconocimiento de voz. " +
        "Las opciones de teclado y texto siguen disponibles."
      );

      return;
    }

    recognition = new Recognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      voiceState(true);
      feedback("Escuchando. Di un comando de la lista.");
    };

    recognition.onresult = (event) => {
      const captions = [];

      for (let i = 0; i < event.results.length; i++) {
        captions.push(event.results[i][0].transcript);
      }

      get("a-caption").textContent =
        "Transcripción: " + captions.join(" ");

      // Ejecutar solo resultados definitivos.
      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        if (event.results[i].isFinal) {
          command(event.results[i][0].transcript);
        }
      }
    };

    recognition.onerror = (event) => {
      failed = true;

      const errors = {
        "not-allowed":
          "Permiso de micrófono denegado. " +
          "Autorízalo desde los permisos del navegador.",

        "audio-capture":
          "No se encontró un micrófono disponible.",

        network:
          "El servicio de voz no pudo conectarse. " +
          "Revisa tu conexión.",

        "no-speech":
          "No se detectó voz. " +
          "Pulsa Activar voz para volver a intentar."
      };

      feedback(
        errors[event.error] ||
        "No fue posible reconocer la voz: " + event.error
      );
    };

    recognition.onend = () => {
      voiceState(false);

      if (!failed) {
        feedback(
          "Micrófono apagado. Pulsa Activar voz para continuar."
        );
      }
    };

    get("a-voice").onclick = () => {
      if (listening) {
        recognition.stop();
        return;
      }

      setReader(false);
      failed = false;

      try {
        recognition.start();
      } catch {
        feedback(
          "El reconocimiento todavía se está iniciando " +
          "o deteniendo. Intenta nuevamente."
        );
      }
    };

    window.addEventListener("pagehide", () => {
      recognition.abort();
    });
  });
})();