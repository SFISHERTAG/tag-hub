import { fn as ElementRef } from "./core-CWWaK1J-.js";
//#region node_modules/@angular/cdk/fesm2022/_element-chunk.mjs
function coerceNumberProperty(value, fallbackValue = 0) {
	if (_isNumberValue(value)) return Number(value);
	return arguments.length === 2 ? fallbackValue : 0;
}
function _isNumberValue(value) {
	return !isNaN(parseFloat(value)) && !isNaN(Number(value));
}
function coerceElement(elementOrRef) {
	return elementOrRef instanceof ElementRef ? elementOrRef.nativeElement : elementOrRef;
}
//#endregion
export { coerceNumberProperty as n, coerceElement as t };
