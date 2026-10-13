function destinoLocalSeguro(valor) {
  if (!valor || !/^[a-z0-9-]+\.html(?:\?[a-z0-9=&%_-]*)?$/i.test(valor)) return null;
  const permitido = ['index.html', 'agendar.html', 'mis-citas.html', 'terapias.html', 'terapia-detalle.html'];
  return permitido.includes(valor.split('?')[0]) ? valor : null;
}

async function registrarUsuario(event) {
  event.preventDefault();

  const nombre = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  const genero = document.getElementById('genero').value;
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (nombre.length < 2 || nombre.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    alert('Revisa el nombre, correo y contraseña (mínimo 8 caracteres).');
    return;
  }
  if (telefono && !/^[0-9+()\-\s]{7,20}$/.test(telefono)) {
    alert('El teléfono no tiene un formato válido.');
    return;
  }
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        nombre: nombre,
        telefono: telefono,
        email: email,
        genero: genero,
        rol: 'paciente'
      },
      emailRedirectTo: window.location.origin + '/login.html'
    }
  });

  if (error) {
    alert('Error al registrar: ' + error.message);
    return;
  }

  if (data.user) {
  const { error: perfilError } = await supabaseClient
    .from('profiles')
    .upsert({
      id: data.user.id,
      email: email,
      nombre: nombre,
      telefono: telefono,
      genero: genero,
      rol: 'paciente'
    });
    if (perfilError) {
      alert('Cuenta registrada, pero el perfil no pudo guardarse. Contacta al administrador.');
      return;
    }
  }

 alert('Cuenta creada exitosamente, favor de iniciar sesion.');
const params = new URLSearchParams(window.location.search);
const redirect = destinoLocalSeguro(params.get('redirect'));

window.location.href = redirect
  ? 'login.html?redirect=' + encodeURIComponent(redirect)
  : 'login.html';}

async function iniciarSesion(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert('Error al iniciar sesión: ' + error.message);
    return;
  }

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    alert('No fue posible verificar la sesión.');
    return;
  }

  const user = sessionData.session.user;

  const { data: perfil, error: perfilError } = await supabaseClient
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!perfilError && perfil && perfil.rol === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const redirect = destinoLocalSeguro(params.get('redirect'));

  if (redirect) {
    window.location.href = redirect;
    return;
  }

  window.location.href = 'index.html';
}
async function cerrarSesion() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert('Error al cerrar sesión: ' + error.message);
    return;
  }

  alert('Sesión cerrada correctamente.');
  window.location.href = 'login.html';
}