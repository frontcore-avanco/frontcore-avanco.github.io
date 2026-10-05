// -----------------------------------------------------------------------
// worker.js — ponte entre a página (app.js) e o motor: recebe comandos,
// executa em segundo plano e responde. Eventos de andamento (log e
// progresso) saem sem `id`, direto pro motor.ligar().
// -----------------------------------------------------------------------
import * as motor from "./motor.js";

motor.ligar((evento) => self.postMessage(evento));

self.onmessage = async ({ data }) => {
  const { id, comando, args } = data;
  try {
    let resultado;
    switch (comando) {
      case "iniciar":
        await motor.iniciar();
        break;
      case "importar":
        await motor.importar(args.arquivo);
        break;
      case "diagnosticar":
        resultado = motor.diagnosticar();
        break;
      case "recuperar":
        resultado = motor.recuperar();
        break;
      case "validar":
        resultado = motor.validar(args.relatorios);
        break;
      case "exportar": {
        const bytes = motor.exportar();
        self.postMessage({ id, ok: true, resultado: bytes }, [bytes.buffer]);
        return;
      }
      case "limpar":
        await motor.limpar();
        break;
      default:
        throw new Error(`Comando desconhecido: ${comando}`);
    }
    self.postMessage({ id, ok: true, resultado });
  } catch (e) {
    self.postMessage({ id, ok: false, erro: (e && e.message) || String(e) });
  }
};
