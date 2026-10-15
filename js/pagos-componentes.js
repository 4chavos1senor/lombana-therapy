/* Resumen de reserva y métodos: sin capturar datos bancarios. */
(() => {
  function inicializar(){
    const raiz = document.getElementById('mp-components');
    if(!raiz) return;
    raiz.innerHTML = `
    <section class="mp-part" aria-label="Resumen de la solicitud"><h3>Resumen de tu cita</h3>
      <p><strong>1.</strong> Terapia: <span id="lt-resumen-terapia">Por elegir</span></p>
      <p><strong>2.</strong> Fecha y hora: <span id="lt-resumen-fecha">Por elegir</span></p>
      <p><strong>3.</strong> Confirmación: <span id="lt-resumen-metodo">Reserva directa</span></p>
    </section>
    <fieldset class="mp-part mp-payment-methods"><legend>¿Cómo deseas reservar o pagar?</legend>
      <div class="mp-payment-grid">
        <label class="mp-payment-choice"><input type="radio" name="lt-forma-cita" value="reserva" checked> Reservar cita real (sin cobro registrado)</label>
        <label class="mp-payment-choice"><input type="radio" name="lt-forma-cita" value="efectivo"> Efectivo en establecimiento (pago pendiente)</label>
        <label class="mp-payment-choice"><input type="radio" name="lt-forma-cita" value="mercadopago"> Tarjeta / transferencia mediante Mercado Pago</label>
        <label class="mp-payment-choice"><input type="radio" name="lt-forma-cita" value="demo"> Simulación escolar (sin cobro; agenda al finalizar)</label>
      </div>
    </fieldset>
    <p class="mp-part" id="lt-aviso-metodo" role="status">La reserva directa crea una cita real en Supabase; no registra ningún cobro.</p>
    <p class="mp-part"><strong>Estado:</strong> <span id="lt-estado-pago">Sin procesar</span></p>
    <p class="mp-part">🔒 La página nunca solicita datos de tarjetas ni contraseñas de pago. La validación de Mercado Pago se hace en el servidor.</p>`;
    function actualizar(){
      const $ = id=>document.getElementById(id);
      const seleccion=$('terapia')?.selectedOptions?.[0]?.textContent || 'Por elegir';
      $('lt-resumen-terapia').textContent=seleccion;
      const fecha=$('fecha')?.value || 'Sin fecha';
      const hora=document.querySelector('.slot-btn.selected')?.textContent || 'Sin horario';
      $('lt-resumen-fecha').textContent=fecha+' — '+hora;
      const valor=raiz.querySelector('input[name="lt-forma-cita"]:checked')?.value||'reserva';
      const texto={reserva:'Reserva real sin cobro',efectivo:'Efectivo pendiente',mercadopago:'Checkout Pro de Mercado Pago',demo:'Simulación sin cobro, reserva posterior'};
      $('lt-resumen-metodo').textContent=texto[valor];
      $('lt-estado-pago').textContent=valor==='demo'?'Sin cobro; reserva pendiente':valor==='reserva'?'Ningún pago registrado':'Pendiente de confirmación';
      $('lt-aviso-metodo').textContent={
        reserva:'Crea una cita real en Supabase. Esta opción NO registra pagos ni asegura que se haya cobrado.',
        efectivo:'Requiere desplegar cash-booking y la migración SQL; la cita solo se confirma si el servidor la guarda. El pago queda pendiente.',
        mercadopago:'Requiere configurar Mercado Pago y desplegar mp-checkout/mp-webhook. La cita solo se confirma tras aprobación verificada del pago.',
        demo:'Primero se muestra una demostración sin cobro. En la siguiente pantalla pulsa «Agendar terapia» para registrar la cita real en Supabase.'
      }[valor];
      const boton=$('btn-pagar');if(boton)boton.textContent=valor==='demo'?'Procesar simulación':valor==='efectivo'?'Reservar y pagar en establecimiento':valor==='mercadopago'?'Continuar a Mercado Pago':'Confirmar cita real';
    }
    raiz.addEventListener('change',actualizar);
    document.getElementById('terapia')?.addEventListener('change',actualizar);
    document.getElementById('fecha')?.addEventListener('change',actualizar);
    document.getElementById('horarios')?.addEventListener('click',()=>queueMicrotask(actualizar));
    actualizar();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inicializar); else inicializar();
})();
