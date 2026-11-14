// Redesenho da tela atual, compartilhado pelas telas (o app.js registra a função de render).
let fn = () => {};
export function setRerender(f) { fn = f; }
export const rerender = () => fn();
