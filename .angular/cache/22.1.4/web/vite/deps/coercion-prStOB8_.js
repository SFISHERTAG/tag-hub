//#region node_modules/@angular/cdk/fesm2022/keycodes.mjs
function hasModifierKey(event, ...modifiers) {
	if (modifiers.length) return modifiers.some((modifier) => event[modifier]);
	return event.altKey || event.shiftKey || event.ctrlKey || event.metaKey;
}
//#endregion
//#region node_modules/@angular/cdk/fesm2022/coercion.mjs
function coerceBooleanProperty(value) {
	return value != null && `${value}` !== "false";
}
//#endregion
export { hasModifierKey as n, coerceBooleanProperty as t };
