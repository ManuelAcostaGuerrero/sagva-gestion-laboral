// El QR de activación de equipo no debe confundirse con las tarjetas de trabajadores.
// Formato de contenido (NO URL): sagva-terminal:<codigo-alta-una-vez>
const PREFIX='sagva-terminal:';
const CODE=/^[A-Za-z0-9_-]{43}$/;
export function terminalActivationQrPayload(code){
 if(typeof code!=='string'||!CODE.test(code))throw new Error('Código de activación inválido.');
 return PREFIX+code;
}
export function parseTerminalActivationQr(value){
 if(typeof value!=='string'||value.length!==PREFIX.length+43||!value.startsWith(PREFIX))return null;
 const code=value.slice(PREFIX.length);
 return CODE.test(code)?code:null;
}
