import { Bi as signal, D as DestroyRef, Gr as isSignal, I as EventEmitter, Mn as forwardRef, U as InjectionToken, W as Injector, _ as untracked, c as computed, et as NgZone, fa as ɵɵnamespaceHTML, lt as RuntimeError, ma as ɵɵnamespaceSVG, mt as Version, sa as ɵɵdefineInjector, xr as inject, yn as effect } from "./_resource-chunk-DMTbwoSS.js";
import { $n as SkipSelf, Ba as ɵɵdefineComponent, Ds as ɵɵtemplate, Fo as ɵɵloadQuery, Ga as ɵɵdirectiveInject, Go as ɵɵproperty, Ha as ɵɵdefineNgModule, Hn as QueryList, Io as ɵɵnextContext, Ji as ɵɵNgOnChangesFeature, Jt as Component, Ks as ɵɵviewQuery, Nn as NgModule, O as booleanAttribute, Os as ɵɵtemplateRefExtractor, Po as ɵɵlistener, Rn as Optional, S as ViewChild, Sn as Input, Uo as ɵɵprojection, Va as ɵɵdefineDirective, Vt as ApplicationRef, Wa as ɵɵdefineService, Wi as ɵɵControlFeature, Wn as Renderer2, Wo as ɵɵprojectionDef, Xi as ɵɵadvance, Xn as Self, Yi as ɵɵProvidersFeature, Zn as Service, a as ContentChildren, ai as isSubscribable, ao as ɵɵelementEnd, as as ɵɵreference, bn as Inject, ca as ɵɵconditional, da as ɵɵcontentQuery, fn as ElementRef, ia as ɵɵattribute, ii as isPromise, ki as setClassMetadata, oa as ɵɵclassProp, oo as ɵɵelementStart, pn as Host, po as ɵɵgetInheritedFactory, pr as ViewEncapsulation, qi as ɵɵInheritDefinitionFeature, r as ChangeDetectorRef, rs as ɵɵqueryRefresh, to as ɵɵelement, ua as ɵɵconditionalCreate, un as Directive, vr as afterNextRender, zn as Output } from "./core-CWWaK1J-.js";
import { Mn as from, Qn as Subject, Tt as debounceTime, Xt as filter, cn as forkJoin, g as takeUntil, m as tap, tn as merge, ur as Subscription, vn as map } from "./esm5-ChK3bs0s.js";
import { t as BidiModule } from "./bidi-Di2066Il.js";
import { i as getDOM } from "./_platform_location-chunk-jLHUbYYr.js";
import "./common-Ck3wKHif.js";
import { F as NgTemplateOutlet } from "./platform-browser-CrVd-asV.js";
import { t as Platform } from "./_platform-chunk-nkLO4Qfa.js";
import { n as coerceNumberProperty } from "./_element-chunk-I4YwJcZV.js";
import { a as ObserversModule, i as CdkObserveContent, o as _CdkPrivateStyleLoader, t as _animationsDisabled, u as _getFocusedElementPierceShadowDom } from "./_animation-chunk-DVy8YaC0.js";
import "./private-DjEJVuvX.js";
import { n as hasModifierKey, t as coerceBooleanProperty } from "./coercion-prStOB8_.js";
import "./platform-BJpsLzd5.js";
import { i as RippleRenderer, n as _StructuralStylesLoader, r as MAT_RIPPLE_GLOBAL_OPTIONS, t as MatRippleModule } from "./_ripple-module-chunk-DWO5F3pb.js";
//#region node_modules/@angular/cdk/fesm2022/_typeahead-chunk.mjs
var DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL_MS = 200;
var Typeahead = class {
	_letterKeyStream = new Subject();
	_items = [];
	_selectedItemIndex = -1;
	_pressedLetters = [];
	_skipPredicateFn;
	_selectedItem = new Subject();
	selectedItem = this._selectedItem;
	constructor(initialItems, config) {
		const typeAheadInterval = typeof config?.debounceInterval === "number" ? config.debounceInterval : DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL_MS;
		if (config?.skipPredicate) this._skipPredicateFn = config.skipPredicate;
		if ((typeof ngDevMode === "undefined" || ngDevMode) && initialItems.length && initialItems.some((item) => typeof item.getLabel !== "function")) throw new Error("KeyManager items in typeahead mode must implement the `getLabel` method.");
		this.setItems(initialItems);
		this._setupKeyHandler(typeAheadInterval);
	}
	destroy() {
		this._pressedLetters = [];
		this._letterKeyStream.complete();
		this._selectedItem.complete();
	}
	setCurrentSelectedItemIndex(index) {
		this._selectedItemIndex = index;
	}
	setItems(items) {
		this._items = items;
	}
	handleKey(event) {
		const keyCode = event.keyCode;
		if (event.key && event.key.length === 1) this._letterKeyStream.next(event.key.toLocaleUpperCase());
		else if (keyCode >= 65 && keyCode <= 90 || keyCode >= 48 && keyCode <= 57) this._letterKeyStream.next(String.fromCharCode(keyCode));
	}
	isTyping() {
		return this._pressedLetters.length > 0;
	}
	reset() {
		this._pressedLetters = [];
	}
	_setupKeyHandler(typeAheadInterval) {
		this._letterKeyStream.pipe(tap((letter) => this._pressedLetters.push(letter)), debounceTime(typeAheadInterval), filter(() => this._pressedLetters.length > 0), map(() => this._pressedLetters.join("").toLocaleUpperCase())).subscribe((inputString) => {
			for (let i = 1; i < this._items.length + 1; i++) {
				const index = (this._selectedItemIndex + i) % this._items.length;
				const item = this._items[index];
				if (!this._skipPredicateFn?.(item) && item.getLabel?.().toLocaleUpperCase().trim().indexOf(inputString) === 0) {
					this._selectedItem.next(item);
					break;
				}
			}
			this._pressedLetters = [];
		});
	}
};
//#endregion
//#region node_modules/@angular/cdk/fesm2022/_list-key-manager-chunk.mjs
var ListKeyManager = class {
	_items;
	_activeItemIndex = signal(-1, ...ngDevMode ? [{ debugName: "_activeItemIndex" }] : []);
	_activeItem = signal(null, ...ngDevMode ? [{ debugName: "_activeItem" }] : []);
	_wrap = false;
	_typeaheadSubscription = Subscription.EMPTY;
	_itemChangesSubscription;
	_vertical = true;
	_horizontal = null;
	_allowedModifierKeys = [];
	_homeAndEnd = false;
	_pageUpAndDown = {
		enabled: false,
		delta: 10
	};
	_effectRef;
	_typeahead;
	_skipPredicateFn = (item) => item.disabled;
	constructor(_items, injector) {
		this._items = _items;
		if (_items instanceof QueryList) this._itemChangesSubscription = _items.changes.subscribe((newItems) => this._itemsChanged(newItems.toArray()));
		else if (isSignal(_items)) {
			if (!injector && (typeof ngDevMode === "undefined" || ngDevMode)) throw new Error("ListKeyManager constructed with a signal must receive an injector");
			this._effectRef = effect(() => this._itemsChanged(_items()), {
				...ngDevMode ? { debugName: "_effectRef" } : {},
				injector
			});
		}
	}
	tabOut = new Subject();
	change = new Subject();
	skipPredicate(predicate) {
		this._skipPredicateFn = predicate;
		return this;
	}
	withWrap(shouldWrap = true) {
		this._wrap = shouldWrap;
		return this;
	}
	withVerticalOrientation(enabled = true) {
		this._vertical = enabled;
		return this;
	}
	withHorizontalOrientation(direction) {
		this._horizontal = direction;
		return this;
	}
	withAllowedModifierKeys(keys) {
		this._allowedModifierKeys = keys;
		return this;
	}
	withTypeAhead(debounceInterval = 200) {
		if (typeof ngDevMode === "undefined" || ngDevMode) {
			const items = this._getItemsArray();
			if (items.length > 0 && items.some((item) => typeof item.getLabel !== "function")) throw Error("ListKeyManager items in typeahead mode must implement the `getLabel` method.");
		}
		this._typeaheadSubscription.unsubscribe();
		const items = this._getItemsArray();
		this._typeahead = new Typeahead(items, {
			debounceInterval: typeof debounceInterval === "number" ? debounceInterval : void 0,
			skipPredicate: (item) => this._skipPredicateFn(item)
		});
		this._typeaheadSubscription = this._typeahead.selectedItem.subscribe((item) => {
			this.setActiveItem(item);
		});
		return this;
	}
	cancelTypeahead() {
		this._typeahead?.reset();
		return this;
	}
	withHomeAndEnd(enabled = true) {
		this._homeAndEnd = enabled;
		return this;
	}
	withPageUpDown(enabled = true, delta = 10) {
		this._pageUpAndDown = {
			enabled,
			delta
		};
		return this;
	}
	setActiveItem(item) {
		const previousActiveItem = this._activeItem();
		this.updateActiveItem(item);
		if (this._activeItem() !== previousActiveItem) this.change.next(this._activeItemIndex());
	}
	onKeydown(event) {
		const keyCode = event.keyCode;
		const isModifierAllowed = [
			"altKey",
			"ctrlKey",
			"metaKey",
			"shiftKey"
		].every((modifier) => {
			return !event[modifier] || this._allowedModifierKeys.indexOf(modifier) > -1;
		});
		switch (keyCode) {
			case 9:
				this.tabOut.next();
				return;
			case 40: if (this._vertical && isModifierAllowed) {
				this.setNextItemActive();
				break;
			} else return;
			case 38: if (this._vertical && isModifierAllowed) {
				this.setPreviousItemActive();
				break;
			} else return;
			case 39: if (this._horizontal && isModifierAllowed) {
				this._horizontal === "rtl" ? this.setPreviousItemActive() : this.setNextItemActive();
				break;
			} else return;
			case 37: if (this._horizontal && isModifierAllowed) {
				this._horizontal === "rtl" ? this.setNextItemActive() : this.setPreviousItemActive();
				break;
			} else return;
			case 36: if (this._homeAndEnd && isModifierAllowed) {
				this.setFirstItemActive();
				break;
			} else return;
			case 35: if (this._homeAndEnd && isModifierAllowed) {
				this.setLastItemActive();
				break;
			} else return;
			case 33: if (this._pageUpAndDown.enabled && isModifierAllowed) {
				const targetIndex = this._activeItemIndex() - this._pageUpAndDown.delta;
				this._setActiveItemByIndex(targetIndex > 0 ? targetIndex : 0, 1);
				break;
			} else return;
			case 34: if (this._pageUpAndDown.enabled && isModifierAllowed) {
				const targetIndex = this._activeItemIndex() + this._pageUpAndDown.delta;
				const itemsLength = this._getItemsArray().length;
				this._setActiveItemByIndex(targetIndex < itemsLength ? targetIndex : itemsLength - 1, -1);
				break;
			} else return;
			default:
				if (isModifierAllowed || hasModifierKey(event, "shiftKey")) this._typeahead?.handleKey(event);
				return;
		}
		this._typeahead?.reset();
		event.preventDefault();
	}
	get activeItemIndex() {
		return this._activeItemIndex();
	}
	get activeItem() {
		return this._activeItem();
	}
	isTyping() {
		return !!this._typeahead && this._typeahead.isTyping();
	}
	setFirstItemActive() {
		this._setActiveItemByIndex(0, 1);
	}
	setLastItemActive() {
		this._setActiveItemByIndex(this._getItemsArray().length - 1, -1);
	}
	setNextItemActive() {
		this._activeItemIndex() < 0 ? this.setFirstItemActive() : this._setActiveItemByDelta(1);
	}
	setPreviousItemActive() {
		this._activeItemIndex() < 0 && this._wrap ? this.setLastItemActive() : this._setActiveItemByDelta(-1);
	}
	updateActiveItem(item) {
		const itemArray = this._getItemsArray();
		const index = typeof item === "number" ? item : itemArray.indexOf(item);
		const activeItem = itemArray[index];
		this._activeItem.set(activeItem == null ? null : activeItem);
		this._activeItemIndex.set(index);
		this._typeahead?.setCurrentSelectedItemIndex(index);
	}
	destroy() {
		this._typeaheadSubscription.unsubscribe();
		this._itemChangesSubscription?.unsubscribe();
		this._effectRef?.destroy();
		this._typeahead?.destroy();
		this.tabOut.complete();
		this.change.complete();
	}
	_setActiveItemByDelta(delta) {
		this._wrap ? this._setActiveInWrapMode(delta) : this._setActiveInDefaultMode(delta);
	}
	_setActiveInWrapMode(delta) {
		const items = this._getItemsArray();
		for (let i = 1; i <= items.length; i++) {
			const index = (this._activeItemIndex() + delta * i + items.length) % items.length;
			const item = items[index];
			if (!this._skipPredicateFn(item)) {
				this.setActiveItem(index);
				return;
			}
		}
	}
	_setActiveInDefaultMode(delta) {
		this._setActiveItemByIndex(this._activeItemIndex() + delta, delta);
	}
	_setActiveItemByIndex(index, fallbackDelta) {
		const items = this._getItemsArray();
		if (!items[index]) return;
		while (this._skipPredicateFn(items[index])) {
			index += fallbackDelta;
			if (!items[index]) return;
		}
		this.setActiveItem(index);
	}
	_getItemsArray() {
		if (isSignal(this._items)) return this._items();
		return this._items instanceof QueryList ? this._items.toArray() : this._items;
	}
	_itemsChanged(newItems) {
		this._typeahead?.setItems(newItems);
		const activeItem = this._activeItem();
		if (activeItem) {
			const newIndex = newItems.indexOf(activeItem);
			if (newIndex > -1 && newIndex !== this._activeItemIndex()) {
				this._activeItemIndex.set(newIndex);
				this._typeahead?.setCurrentSelectedItemIndex(newIndex);
			}
		}
	}
};
//#endregion
//#region node_modules/@angular/cdk/fesm2022/_focus-key-manager-chunk.mjs
var FocusKeyManager = class extends ListKeyManager {
	_origin = "program";
	setFocusOrigin(origin) {
		this._origin = origin;
		return this;
	}
	setActiveItem(item) {
		super.setActiveItem(item);
		if (this.activeItem) this.activeItem.focus(this._origin);
	}
};
//#endregion
//#region node_modules/@angular/cdk/fesm2022/_selection-model-chunk.mjs
var SelectionModel = class {
	_multiple;
	_emitChanges;
	compareWith;
	_selection = /* @__PURE__ */ new Set();
	_deselectedToEmit = [];
	_selectedToEmit = [];
	_selected = null;
	get selected() {
		if (!this._selected) this._selected = Array.from(this._selection.values());
		return this._selected;
	}
	changed = new Subject();
	bulk = {
		select: (values) => this._select(values),
		deselect: (values) => this._deselect(values),
		setSelection: (values) => this._setSelection(values)
	};
	constructor(_multiple = false, initiallySelectedValues, _emitChanges = true, compareWith) {
		this._multiple = _multiple;
		this._emitChanges = _emitChanges;
		this.compareWith = compareWith;
		if (initiallySelectedValues && initiallySelectedValues.length) {
			if (_multiple) initiallySelectedValues.forEach((value) => this._markSelected(value));
			else this._markSelected(initiallySelectedValues[0]);
			this._selectedToEmit.length = 0;
		}
	}
	select(...values) {
		return this._select(values);
	}
	deselect(...values) {
		return this._deselect(values);
	}
	setSelection(...values) {
		return this._setSelection(values);
	}
	toggle(value) {
		return this.isSelected(value) ? this.deselect(value) : this.select(value);
	}
	clear(flushEvent = true) {
		this._unmarkAll();
		const changed = this._hasQueuedChanges();
		if (flushEvent) this._emitChangeEvent();
		return changed;
	}
	isSelected(value) {
		return this._selection.has(this._getConcreteValue(value));
	}
	isEmpty() {
		return this._selection.size === 0;
	}
	hasValue() {
		return !this.isEmpty();
	}
	sort(predicate) {
		if (this._multiple && this.selected) this._selected.sort(predicate);
	}
	isMultipleSelection() {
		return this._multiple;
	}
	_select(values) {
		this._verifyValueAssignment(values);
		values.forEach((value) => this._markSelected(value));
		const changed = this._hasQueuedChanges();
		this._emitChangeEvent();
		return changed;
	}
	_deselect(values) {
		this._verifyValueAssignment(values);
		values.forEach((value) => this._unmarkSelected(value));
		const changed = this._hasQueuedChanges();
		this._emitChangeEvent();
		return changed;
	}
	_setSelection(values) {
		this._verifyValueAssignment(values);
		const oldValues = this.selected;
		const newSelectedSet = new Set(values.map((value) => this._getConcreteValue(value)));
		values.forEach((value) => this._markSelected(value));
		oldValues.filter((value) => !newSelectedSet.has(this._getConcreteValue(value, newSelectedSet))).forEach((value) => this._unmarkSelected(value));
		const changed = this._hasQueuedChanges();
		this._emitChangeEvent();
		return changed;
	}
	_emitChangeEvent() {
		this._selected = null;
		if (this._selectedToEmit.length || this._deselectedToEmit.length) {
			this.changed.next({
				source: this,
				added: this._selectedToEmit,
				removed: this._deselectedToEmit
			});
			this._deselectedToEmit = [];
			this._selectedToEmit = [];
		}
	}
	_markSelected(value) {
		value = this._getConcreteValue(value);
		if (!this.isSelected(value)) {
			if (!this._multiple) this._unmarkAll();
			if (!this.isSelected(value)) this._selection.add(value);
			if (this._emitChanges) this._selectedToEmit.push(value);
		}
	}
	_unmarkSelected(value) {
		value = this._getConcreteValue(value);
		if (this.isSelected(value)) {
			this._selection.delete(value);
			if (this._emitChanges) this._deselectedToEmit.push(value);
		}
	}
	_unmarkAll() {
		if (!this.isEmpty()) this._selection.forEach((value) => this._unmarkSelected(value));
	}
	_verifyValueAssignment(values) {
		if (values.length > 1 && !this._multiple && (typeof ngDevMode === "undefined" || ngDevMode)) throw getMultipleValuesInSingleSelectionError();
	}
	_hasQueuedChanges() {
		return !!(this._deselectedToEmit.length || this._selectedToEmit.length);
	}
	_getConcreteValue(inputValue, selection) {
		if (!this.compareWith) return inputValue;
		else {
			selection = selection ?? this._selection;
			for (let selectedValue of selection) if (this.compareWith(inputValue, selectedValue)) return selectedValue;
			return inputValue;
		}
	}
};
function getMultipleValuesInSingleSelectionError() {
	return Error("Cannot pass multiple values into SelectionModel with single-value mode.");
}
//#endregion
//#region node_modules/@angular/forms/fesm2022/forms.mjs
/**
* @license Angular v22.1.2
* (c) 2010-2026 Google LLC. https://angular.dev/
* License: MIT
*/
var BaseControlValueAccessor = class BaseControlValueAccessor {
	_renderer;
	_elementRef;
	onChange = (_) => {};
	onTouched = () => {};
	constructor(_renderer, _elementRef) {
		this._renderer = _renderer;
		this._elementRef = _elementRef;
	}
	setProperty(key, value) {
		this._renderer.setProperty(this._elementRef.nativeElement, key, value);
	}
	registerOnTouched(fn) {
		this.onTouched = fn;
	}
	registerOnChange(fn) {
		this.onChange = fn;
	}
	setDisabledState(isDisabled) {
		this.setProperty("disabled", isDisabled);
	}
	static ɵfac = function BaseControlValueAccessor_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || BaseControlValueAccessor)(ɵɵdirectiveInject(Renderer2), ɵɵdirectiveInject(ElementRef));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({ type: BaseControlValueAccessor });
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BaseControlValueAccessor, [{ type: Directive }], () => [{ type: Renderer2 }, { type: ElementRef }], null);
})();
var BuiltInControlValueAccessor = class BuiltInControlValueAccessor extends BaseControlValueAccessor {
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵBuiltInControlValueAccessor_BaseFactory;
		return function BuiltInControlValueAccessor_Factory(__ngFactoryType__) {
			return (ɵBuiltInControlValueAccessor_BaseFactory || (ɵBuiltInControlValueAccessor_BaseFactory = ɵɵgetInheritedFactory(BuiltInControlValueAccessor)))(__ngFactoryType__ || BuiltInControlValueAccessor);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: BuiltInControlValueAccessor,
		features: [ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BuiltInControlValueAccessor, [{ type: Directive }], null, null);
})();
var NG_VALUE_ACCESSOR = new InjectionToken(typeof ngDevMode !== "undefined" && ngDevMode ? "NgValueAccessor" : "");
var CHECKBOX_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => CheckboxControlValueAccessor),
	multi: true
};
var CheckboxControlValueAccessor = class CheckboxControlValueAccessor extends BuiltInControlValueAccessor {
	writeValue(value) {
		this.setProperty("checked", value);
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵCheckboxControlValueAccessor_BaseFactory;
		return function CheckboxControlValueAccessor_Factory(__ngFactoryType__) {
			return (ɵCheckboxControlValueAccessor_BaseFactory || (ɵCheckboxControlValueAccessor_BaseFactory = ɵɵgetInheritedFactory(CheckboxControlValueAccessor)))(__ngFactoryType__ || CheckboxControlValueAccessor);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: CheckboxControlValueAccessor,
		selectors: [
			[
				"input",
				"type",
				"checkbox",
				"formControlName",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"checkbox",
				"formControl",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"checkbox",
				"ngModel",
				"",
				3,
				"ngNoCva",
				""
			]
		],
		hostBindings: function CheckboxControlValueAccessor_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("change", function CheckboxControlValueAccessor_change_HostBindingHandler($event) {
				return ctx.onChange($event.target.checked);
			})("blur", function CheckboxControlValueAccessor_blur_HostBindingHandler() {
				return ctx.onTouched();
			});
		},
		standalone: false,
		features: [ɵɵProvidersFeature([CHECKBOX_VALUE_ACCESSOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CheckboxControlValueAccessor, [{
		type: Directive,
		args: [{
			selector: "input[type=checkbox]:not([ngNoCva])[formControlName],input[type=checkbox]:not([ngNoCva])[formControl],input[type=checkbox]:not([ngNoCva])[ngModel]",
			host: {
				"(change)": "onChange($any($event.target).checked)",
				"(blur)": "onTouched()"
			},
			providers: [CHECKBOX_VALUE_ACCESSOR],
			standalone: false
		}]
	}], null, null);
})();
var DEFAULT_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => DefaultValueAccessor),
	multi: true
};
function _isAndroid() {
	const userAgent = getDOM() ? getDOM().getUserAgent() : "";
	return /android (\d+)/.test(userAgent.toLowerCase());
}
var COMPOSITION_BUFFER_MODE = new InjectionToken(typeof ngDevMode !== "undefined" && ngDevMode ? "CompositionEventMode" : "");
var DefaultValueAccessor = class DefaultValueAccessor extends BaseControlValueAccessor {
	_compositionMode;
	_composing = false;
	constructor(renderer, elementRef, _compositionMode) {
		super(renderer, elementRef);
		this._compositionMode = _compositionMode;
		if (this._compositionMode == null) this._compositionMode = !_isAndroid();
	}
	writeValue(value) {
		const normalizedValue = value == null ? "" : value;
		this.setProperty("value", normalizedValue);
	}
	_handleInput(value) {
		if (!this._compositionMode || this._compositionMode && !this._composing) this.onChange(value);
	}
	_compositionStart() {
		this._composing = true;
	}
	_compositionEnd(value) {
		this._composing = false;
		this._compositionMode && this.onChange(value);
	}
	static ɵfac = function DefaultValueAccessor_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || DefaultValueAccessor)(ɵɵdirectiveInject(Renderer2), ɵɵdirectiveInject(ElementRef), ɵɵdirectiveInject(COMPOSITION_BUFFER_MODE, 8));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: DefaultValueAccessor,
		selectors: [
			[
				"input",
				"formControlName",
				"",
				3,
				"type",
				"checkbox",
				3,
				"ngNoCva",
				""
			],
			[
				"textarea",
				"formControlName",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"formControl",
				"",
				3,
				"type",
				"checkbox",
				3,
				"ngNoCva",
				""
			],
			[
				"textarea",
				"formControl",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"ngModel",
				"",
				3,
				"type",
				"checkbox",
				3,
				"ngNoCva",
				""
			],
			[
				"textarea",
				"ngModel",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"",
				"ngDefaultControl",
				""
			]
		],
		hostBindings: function DefaultValueAccessor_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("input", function DefaultValueAccessor_input_HostBindingHandler($event) {
				return ctx._handleInput($event.target.value);
			})("blur", function DefaultValueAccessor_blur_HostBindingHandler() {
				return ctx.onTouched();
			})("compositionstart", function DefaultValueAccessor_compositionstart_HostBindingHandler() {
				return ctx._compositionStart();
			})("compositionend", function DefaultValueAccessor_compositionend_HostBindingHandler($event) {
				return ctx._compositionEnd($event.target.value);
			});
		},
		standalone: false,
		features: [ɵɵProvidersFeature([DEFAULT_VALUE_ACCESSOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(DefaultValueAccessor, [{
		type: Directive,
		args: [{
			selector: "input:not([type=checkbox]):not([ngNoCva])[formControlName],textarea:not([ngNoCva])[formControlName],input:not([type=checkbox]):not([ngNoCva])[formControl],textarea:not([ngNoCva])[formControl],input:not([type=checkbox]):not([ngNoCva])[ngModel],textarea:not([ngNoCva])[ngModel],[ngDefaultControl]",
			host: {
				"(input)": "_handleInput($any($event.target).value)",
				"(blur)": "onTouched()",
				"(compositionstart)": "_compositionStart()",
				"(compositionend)": "_compositionEnd($any($event.target).value)"
			},
			providers: [DEFAULT_VALUE_ACCESSOR],
			standalone: false
		}]
	}], () => [
		{ type: Renderer2 },
		{ type: ElementRef },
		{
			type: void 0,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [COMPOSITION_BUFFER_MODE]
			}]
		}
	], null);
})();
function isEmptyInputValue(value) {
	return value == null || lengthOrSize(value) === 0;
}
function lengthOrSize(value) {
	if (value == null) return null;
	else if (Array.isArray(value) || typeof value === "string") return value.length;
	else if (value instanceof Set) return value.size;
	return null;
}
var NG_VALIDATORS = new InjectionToken(typeof ngDevMode !== "undefined" && ngDevMode ? "NgValidators" : "");
var NG_ASYNC_VALIDATORS = new InjectionToken(typeof ngDevMode !== "undefined" && ngDevMode ? "NgAsyncValidators" : "");
var EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
var Validators = class {
	static min(min) {
		return minValidator(min);
	}
	static max(max) {
		return maxValidator(max);
	}
	static required(control) {
		return requiredValidator(control);
	}
	static requiredTrue(control) {
		return requiredTrueValidator(control);
	}
	static email(control) {
		return emailValidator(control);
	}
	static minLength(minLength) {
		return minLengthValidator(minLength);
	}
	static maxLength(maxLength) {
		return maxLengthValidator(maxLength);
	}
	static pattern(pattern) {
		return patternValidator(pattern);
	}
	static nullValidator(control) {
		return nullValidator();
	}
	static compose(validators) {
		return compose(validators);
	}
	static composeAsync(validators) {
		return composeAsync(validators);
	}
};
function minValidator(min) {
	return (control) => {
		if (control.value == null || min == null) return null;
		const value = parseFloat(control.value);
		return !isNaN(value) && value < min ? { "min": {
			"min": min,
			"actual": control.value
		} } : null;
	};
}
function maxValidator(max) {
	return (control) => {
		if (control.value == null || max == null) return null;
		const value = parseFloat(control.value);
		return !isNaN(value) && value > max ? { "max": {
			"max": max,
			"actual": control.value
		} } : null;
	};
}
function requiredValidator(control) {
	return isEmptyInputValue(control.value) ? { "required": true } : null;
}
function requiredTrueValidator(control) {
	return control.value === true ? null : { "required": true };
}
function emailValidator(control) {
	if (isEmptyInputValue(control.value)) return null;
	return EMAIL_REGEXP.test(control.value) ? null : { "email": true };
}
function minLengthValidator(minLength) {
	return (control) => {
		const length = control.value?.length ?? lengthOrSize(control.value);
		if (length === null || length === 0) return null;
		return length < minLength ? { "minlength": {
			"requiredLength": minLength,
			"actualLength": length
		} } : null;
	};
}
function maxLengthValidator(maxLength) {
	return (control) => {
		const length = control.value?.length ?? lengthOrSize(control.value);
		if (length !== null && length > maxLength) return { "maxlength": {
			"requiredLength": maxLength,
			"actualLength": length
		} };
		return null;
	};
}
function patternValidator(pattern) {
	if (!pattern) return nullValidator;
	let regex;
	let regexStr;
	if (typeof pattern === "string") {
		regexStr = "";
		if (pattern.charAt(0) !== "^") regexStr += "^";
		regexStr += pattern;
		if (pattern.charAt(pattern.length - 1) !== "$") regexStr += "$";
		regex = new RegExp(regexStr);
	} else {
		regexStr = pattern.toString();
		regex = pattern;
	}
	return (control) => {
		if (isEmptyInputValue(control.value)) return null;
		const value = control.value;
		return regex.test(value) ? null : { "pattern": {
			"requiredPattern": regexStr,
			"actualValue": value
		} };
	};
}
function nullValidator(control) {
	return null;
}
function isPresent(o) {
	return o != null;
}
function toObservable(value) {
	const obs = isPromise(value) ? from(value) : value;
	if ((typeof ngDevMode === "undefined" || ngDevMode) && !isSubscribable(obs)) {
		let errorMessage = `Expected async validator to return Promise or Observable.`;
		if (typeof value === "object") errorMessage += " Are you using a synchronous validator where an async validator is expected?";
		throw new RuntimeError(-1101, errorMessage);
	}
	return obs;
}
function mergeErrors(arrayOfErrors) {
	let res = {};
	arrayOfErrors.forEach((errors) => {
		res = errors != null ? {
			...res,
			...errors
		} : res;
	});
	return Object.keys(res).length === 0 ? null : res;
}
function executeValidators(control, validators) {
	return validators.map((validator) => validator(control));
}
function isValidatorFn(validator) {
	return !validator.validate;
}
function normalizeValidators(validators) {
	return validators.map((validator) => {
		return isValidatorFn(validator) ? validator : (c) => validator.validate(c);
	});
}
function compose(validators) {
	if (!validators) return null;
	const presentValidators = validators.filter(isPresent);
	if (presentValidators.length == 0) return null;
	return function(control) {
		return mergeErrors(executeValidators(control, presentValidators));
	};
}
function composeValidators(validators) {
	return validators != null ? compose(normalizeValidators(validators)) : null;
}
function composeAsync(validators) {
	if (!validators) return null;
	const presentValidators = validators.filter(isPresent);
	if (presentValidators.length == 0) return null;
	return function(control) {
		return forkJoin(executeValidators(control, presentValidators).map(toObservable)).pipe(map(mergeErrors));
	};
}
function composeAsyncValidators(validators) {
	return validators != null ? composeAsync(normalizeValidators(validators)) : null;
}
function mergeValidators(controlValidators, dirValidator) {
	if (controlValidators === null) return [dirValidator];
	return Array.isArray(controlValidators) ? [...controlValidators, dirValidator] : [controlValidators, dirValidator];
}
function getControlValidators(control) {
	return control._rawValidators;
}
function getControlAsyncValidators(control) {
	return control._rawAsyncValidators;
}
function makeValidatorsArray(validators) {
	if (!validators) return [];
	return Array.isArray(validators) ? validators : [validators];
}
function hasValidator(validators, validator) {
	return Array.isArray(validators) ? validators.includes(validator) : validators === validator;
}
function addValidators(validators, currentValidators) {
	const current = makeValidatorsArray(currentValidators);
	makeValidatorsArray(validators).forEach((v) => {
		if (!hasValidator(current, v)) current.push(v);
	});
	return current;
}
function removeValidators(validators, currentValidators) {
	return makeValidatorsArray(currentValidators).filter((v) => !hasValidator(validators, v));
}
var AbstractControlDirective = class {
	get value() {
		return this.control ? this.control.value : null;
	}
	get valid() {
		return this.control ? this.control.valid : null;
	}
	get invalid() {
		return this.control ? this.control.invalid : null;
	}
	get pending() {
		return this.control ? this.control.pending : null;
	}
	get disabled() {
		return this.control ? this.control.disabled : null;
	}
	get enabled() {
		return this.control ? this.control.enabled : null;
	}
	get errors() {
		return this.control ? this.control.errors : null;
	}
	get pristine() {
		return this.control ? this.control.pristine : null;
	}
	get dirty() {
		return this.control ? this.control.dirty : null;
	}
	get touched() {
		return this.control ? this.control.touched : null;
	}
	get status() {
		return this.control ? this.control.status : null;
	}
	get untouched() {
		return this.control ? this.control.untouched : null;
	}
	get statusChanges() {
		return this.control ? this.control.statusChanges : null;
	}
	get valueChanges() {
		return this.control ? this.control.valueChanges : null;
	}
	get path() {
		return null;
	}
	_composedValidatorFn;
	_composedAsyncValidatorFn;
	_rawValidators = [];
	_rawAsyncValidators = [];
	_setValidators(validators) {
		this._rawValidators = validators || [];
		this._composedValidatorFn = composeValidators(this._rawValidators);
	}
	_setAsyncValidators(validators) {
		this._rawAsyncValidators = validators || [];
		this._composedAsyncValidatorFn = composeAsyncValidators(this._rawAsyncValidators);
	}
	get validator() {
		return this._composedValidatorFn || null;
	}
	get asyncValidator() {
		return this._composedAsyncValidatorFn || null;
	}
	_onDestroyCallbacks = [];
	_registerOnDestroy(fn) {
		this._onDestroyCallbacks.push(fn);
	}
	_invokeOnDestroyCallbacks() {
		this._onDestroyCallbacks.forEach((fn) => fn());
		this._onDestroyCallbacks = [];
	}
	reset(value = void 0) {
		this.control?.reset(value);
	}
	hasError(errorCode, path) {
		return this.control ? this.control.hasError(errorCode, path) : false;
	}
	getError(errorCode, path) {
		return this.control ? this.control.getError(errorCode, path) : null;
	}
};
var ControlContainer = class extends AbstractControlDirective {
	name;
	get formDirective() {
		return null;
	}
	get path() {
		return null;
	}
};
var formControlNameExample = `
  <div [formGroup]="myGroup">
    <input formControlName="firstName">
  </div>

  In your class:

  this.myGroup = new FormGroup({
      firstName: new FormControl()
  });`;
var formGroupNameExample = `
  <div [formGroup]="myGroup">
      <div formGroupName="person">
        <input formControlName="firstName">
      </div>
  </div>

  In your class:

  this.myGroup = new FormGroup({
      person: new FormGroup({ firstName: new FormControl() })
  });`;
var formArrayNameExample = `
  <div [formGroup]="myGroup">
    <div formArrayName="cities">
      <div *ngFor="let city of cityArray.controls; index as i">
        <input [formControlName]="i">
      </div>
    </div>
  </div>

  In your class:

  this.cityArray = new FormArray([new FormControl('SF')]);
  this.myGroup = new FormGroup({
    cities: this.cityArray
  });`;
var ngModelGroupExample = `
  <form>
      <div ngModelGroup="person">
        <input [(ngModel)]="person.name" name="firstName">
      </div>
  </form>`;
var ngModelWithFormGroupExample = `
  <div [formGroup]="myGroup">
      <input formControlName="firstName">
      <input [(ngModel)]="showMoreControls" [ngModelOptions]="{standalone: true}">
  </div>
`;
var VERSION = /* @__PURE__ */ new Version("22.1.2");
function controlParentException(nameOrIndex) {
	return new RuntimeError(1050, `formControlName must be used with a parent formGroup or formArray directive. You'll want to add a formGroup/formArray
      directive and pass it an existing FormGroup/FormArray instance (you can create one in your class).

      ${describeFormControl(nameOrIndex)}

    Example:

    ${formControlNameExample}`);
}
function describeFormControl(nameOrIndex) {
	if (nameOrIndex == null || nameOrIndex === "") return "";
	return `Affected Form Control ${typeof nameOrIndex === "string" ? "name" : "index"}: "${nameOrIndex}"`;
}
function ngModelGroupException() {
	return new RuntimeError(1051, `formControlName cannot be used with an ngModelGroup parent. It is only compatible with parents
      that also have a "form" prefix: formGroupName, formArrayName, or formGroup.

      Option 1:  Update the parent to be formGroupName (reactive form strategy)

      ${formGroupNameExample}

      Option 2: Use ngModel instead of formControlName (template-driven strategy)

      ${ngModelGroupExample}`);
}
function missingFormException() {
	return new RuntimeError(1052, `formGroup expects a FormGroup instance. Please pass one in.

      Example:

      ${formControlNameExample}`);
}
function groupParentException() {
	return new RuntimeError(1053, `formGroupName must be used with a parent formGroup directive.  You'll want to add a formGroup
    directive and pass it an existing FormGroup instance (you can create one in your class).

    Example:

    ${formGroupNameExample}`);
}
function arrayParentException() {
	return new RuntimeError(1054, `formArrayName must be used with a parent formGroup directive.  You'll want to add a formGroup
      directive and pass it an existing FormGroup instance (you can create one in your class).

      Example:

      ${formArrayNameExample}`);
}
var disabledAttrWarning = `
  It looks like you're using the disabled attribute with a reactive form directive. If you set disabled to true
  when you set up this control in your component class, the disabled attribute will actually be set in the DOM for
  you. We recommend using this approach to avoid 'changed after checked' errors.

  Example:
  // Specify the \`disabled\` property at control creation time:
  form = new FormGroup({
    first: new FormControl({value: 'Nancy', disabled: true}, Validators.required),
    last: new FormControl('Drew', Validators.required)
  });

  // Controls can also be enabled/disabled after creation:
  form.get('first')?.enable();
  form.get('last')?.disable();
`;
var asyncValidatorsDroppedWithOptsWarning = `
  It looks like you're constructing using a FormControl with both an options argument and an
  async validators argument. Mixing these arguments will cause your async validators to be dropped.
  You should either put all your validators in the options object, or in separate validators
  arguments. For example:

  // Using validators arguments
  fc = new FormControl(42, Validators.required, myAsyncValidator);

  // Using AbstractControlOptions
  fc = new FormControl(42, {validators: Validators.required, asyncValidators: myAV});

  // Do NOT mix them: async validators will be dropped!
  fc = new FormControl(42, {validators: Validators.required}, /* Oops! */ myAsyncValidator);
`;
function ngModelWarning(directiveName) {
	return `
  It looks like you're using ngModel on the same form field as ${directiveName}.
  Support for using the ngModel input property and ngModelChange event with
  reactive form directives has been deprecated in Angular v6 and will be removed
  in a future version of Angular.

  For more information on this, see our API docs here:
  https://${VERSION.major !== "0" ? `v${VERSION.major}.` : ""}angular.dev/api/forms/${directiveName === "formControl" ? "FormControlDirective" : "FormControlName"}
  `;
}
function describeKey(isFormGroup, key) {
	return isFormGroup ? `with name: '${key}'` : `at index: ${key}`;
}
function noControlsError(isFormGroup) {
	return `
    There are no form controls registered with this ${isFormGroup ? "group" : "array"} yet. If you're using ngModel,
    you may want to check next tick (e.g. use setTimeout).
  `;
}
function missingControlError(isFormGroup, key) {
	return `Cannot find form control ${describeKey(isFormGroup, key)}`;
}
function missingControlValueError(isFormGroup, key) {
	return `Must supply a value for form control ${describeKey(isFormGroup, key)}`;
}
var VALID = "VALID";
var INVALID = "INVALID";
var PENDING = "PENDING";
var DISABLED = "DISABLED";
var ControlEvent = class {};
var ValueChangeEvent = class extends ControlEvent {
	value;
	source;
	constructor(value, source) {
		super();
		this.value = value;
		this.source = source;
	}
};
var PristineChangeEvent = class extends ControlEvent {
	pristine;
	source;
	constructor(pristine, source) {
		super();
		this.pristine = pristine;
		this.source = source;
	}
};
var TouchedChangeEvent = class extends ControlEvent {
	touched;
	source;
	constructor(touched, source) {
		super();
		this.touched = touched;
		this.source = source;
	}
};
var StatusChangeEvent = class extends ControlEvent {
	status;
	source;
	constructor(status, source) {
		super();
		this.status = status;
		this.source = source;
	}
};
var FormSubmittedEvent = class extends ControlEvent {
	source;
	constructor(source) {
		super();
		this.source = source;
	}
};
var FormResetEvent = class extends ControlEvent {
	source;
	constructor(source) {
		super();
		this.source = source;
	}
};
function pickValidators(validatorOrOpts) {
	return (isOptionsObj(validatorOrOpts) ? validatorOrOpts.validators : validatorOrOpts) || null;
}
function coerceToValidator(validator) {
	return Array.isArray(validator) ? composeValidators(validator) : validator || null;
}
function pickAsyncValidators(asyncValidator, validatorOrOpts) {
	if (typeof ngDevMode === "undefined" || ngDevMode) {
		if (isOptionsObj(validatorOrOpts) && asyncValidator) console.warn(asyncValidatorsDroppedWithOptsWarning);
	}
	return (isOptionsObj(validatorOrOpts) ? validatorOrOpts.asyncValidators : asyncValidator) || null;
}
function coerceToAsyncValidator(asyncValidator) {
	return Array.isArray(asyncValidator) ? composeAsyncValidators(asyncValidator) : asyncValidator || null;
}
function isOptionsObj(validatorOrOpts) {
	return validatorOrOpts != null && !Array.isArray(validatorOrOpts) && typeof validatorOrOpts === "object";
}
function assertControlPresent(parent, isGroup, key) {
	const controls = parent.controls;
	if (!(isGroup ? Object.keys(controls) : controls).length) throw new RuntimeError(1e3, typeof ngDevMode === "undefined" || ngDevMode ? noControlsError(isGroup) : "");
	if (!hasOwnControl(controls, key)) throw new RuntimeError(1001, typeof ngDevMode === "undefined" || ngDevMode ? missingControlError(isGroup, key) : "");
}
function assertAllValuesPresent(control, isGroup, value) {
	control._forEachChild((_, key) => {
		if (value[key] === void 0) throw new RuntimeError(-1002, typeof ngDevMode === "undefined" || ngDevMode ? missingControlValueError(isGroup, key) : "");
	});
}
var AbstractControl = class {
	_pendingDirty = false;
	_hasOwnPendingAsyncValidator = null;
	_pendingTouched = false;
	_onCollectionChange = () => {};
	_updateOn;
	_hasRequired = signal(false, ...ngDevMode ? [{ debugName: "_hasRequired" }] : []);
	_parent = null;
	_asyncValidationSubscription;
	_composedValidatorFn;
	_composedAsyncValidatorFn;
	_rawValidators;
	_rawAsyncValidators;
	value;
	constructor(validators, asyncValidators) {
		this._assignValidators(validators);
		this._assignAsyncValidators(asyncValidators);
	}
	get validator() {
		return this._composedValidatorFn;
	}
	set validator(validatorFn) {
		this._rawValidators = this._composedValidatorFn = validatorFn;
		this._updateHasRequiredValidator();
	}
	get asyncValidator() {
		return this._composedAsyncValidatorFn;
	}
	set asyncValidator(asyncValidatorFn) {
		this._rawAsyncValidators = this._composedAsyncValidatorFn = asyncValidatorFn;
	}
	get parent() {
		return this._parent;
	}
	get status() {
		return untracked(this.statusReactive);
	}
	set status(v) {
		untracked(() => this.statusReactive.set(v));
	}
	_status = computed(() => this.statusReactive(), ...ngDevMode ? [{ debugName: "_status" }] : []);
	statusReactive = signal(void 0, ...ngDevMode ? [{ debugName: "statusReactive" }] : []);
	get valid() {
		return this.status === VALID;
	}
	get invalid() {
		return this.status === INVALID;
	}
	get pending() {
		return this.status === PENDING;
	}
	get disabled() {
		return this.status === DISABLED;
	}
	get enabled() {
		return this.status !== DISABLED;
	}
	errors;
	get pristine() {
		return untracked(this.pristineReactive);
	}
	set pristine(v) {
		untracked(() => this.pristineReactive.set(v));
	}
	_pristine = computed(() => this.pristineReactive(), ...ngDevMode ? [{ debugName: "_pristine" }] : []);
	pristineReactive = signal(true, ...ngDevMode ? [{ debugName: "pristineReactive" }] : []);
	get dirty() {
		return !this.pristine;
	}
	get touched() {
		return untracked(this.touchedReactive);
	}
	set touched(v) {
		untracked(() => this.touchedReactive.set(v));
	}
	_touched = computed(() => this.touchedReactive(), ...ngDevMode ? [{ debugName: "_touched" }] : []);
	touchedReactive = signal(false, ...ngDevMode ? [{ debugName: "touchedReactive" }] : []);
	get untouched() {
		return !this.touched;
	}
	_events = new Subject();
	events = this._events.asObservable();
	valueChanges;
	statusChanges;
	get updateOn() {
		return this._updateOn ? this._updateOn : this.parent ? this.parent.updateOn : "change";
	}
	setValidators(validators) {
		this._assignValidators(validators);
	}
	setAsyncValidators(validators) {
		this._assignAsyncValidators(validators);
	}
	addValidators(validators) {
		this.setValidators(addValidators(validators, this._rawValidators));
	}
	addAsyncValidators(validators) {
		this.setAsyncValidators(addValidators(validators, this._rawAsyncValidators));
	}
	removeValidators(validators) {
		this.setValidators(removeValidators(validators, this._rawValidators));
	}
	removeAsyncValidators(validators) {
		this.setAsyncValidators(removeValidators(validators, this._rawAsyncValidators));
	}
	hasValidator(validator) {
		return hasValidator(this._rawValidators, validator);
	}
	hasAsyncValidator(validator) {
		return hasValidator(this._rawAsyncValidators, validator);
	}
	clearValidators() {
		this.validator = null;
	}
	clearAsyncValidators() {
		this.asyncValidator = null;
	}
	markAsTouched(opts = {}) {
		const changed = this.touched === false;
		this.touched = true;
		const sourceControl = opts.sourceControl ?? this;
		if (!opts.onlySelf) this._parent?.markAsTouched({
			...opts,
			sourceControl
		});
		if (changed && opts.emitEvent !== false) this._events.next(new TouchedChangeEvent(true, sourceControl));
	}
	markAllAsDirty(opts = {}) {
		this.markAsDirty({
			onlySelf: true,
			emitEvent: opts.emitEvent,
			sourceControl: this
		});
		this._forEachChild((control) => control.markAllAsDirty(opts));
	}
	markAllAsTouched(opts = {}) {
		this.markAsTouched({
			onlySelf: true,
			emitEvent: opts.emitEvent,
			sourceControl: this
		});
		this._forEachChild((control) => control.markAllAsTouched(opts));
	}
	markAsUntouched(opts = {}) {
		const changed = this.touched === true;
		this.touched = false;
		this._pendingTouched = false;
		const sourceControl = opts.sourceControl ?? this;
		this._forEachChild((control) => {
			control.markAsUntouched({
				onlySelf: true,
				emitEvent: opts.emitEvent,
				sourceControl
			});
		});
		if (!opts.onlySelf) this._parent?._updateTouched(opts, sourceControl);
		if (changed && opts.emitEvent !== false) this._events.next(new TouchedChangeEvent(false, sourceControl));
	}
	markAsDirty(opts = {}) {
		const changed = this.pristine === true;
		this.pristine = false;
		const sourceControl = opts.sourceControl ?? this;
		if (!opts.onlySelf) this._parent?.markAsDirty({
			...opts,
			sourceControl
		});
		if (changed && opts.emitEvent !== false) this._events.next(new PristineChangeEvent(false, sourceControl));
	}
	markAsPristine(opts = {}) {
		const changed = this.pristine === false;
		this.pristine = true;
		this._pendingDirty = false;
		const sourceControl = opts.sourceControl ?? this;
		this._forEachChild((control) => {
			control.markAsPristine({
				onlySelf: true,
				emitEvent: opts.emitEvent
			});
		});
		if (!opts.onlySelf) this._parent?._updatePristine(opts, sourceControl);
		if (changed && opts.emitEvent !== false) this._events.next(new PristineChangeEvent(true, sourceControl));
	}
	markAsPending(opts = {}) {
		this.status = PENDING;
		const sourceControl = opts.sourceControl ?? this;
		if (opts.emitEvent !== false) {
			this._events.next(new StatusChangeEvent(this.status, sourceControl));
			this.statusChanges.emit(this.status);
		}
		if (!opts.onlySelf) this._parent?.markAsPending({
			...opts,
			sourceControl
		});
	}
	disable(opts = {}) {
		const skipPristineCheck = this._parentMarkedDirty(opts.onlySelf);
		this.status = DISABLED;
		this.errors = null;
		this._forEachChild((control) => {
			control.disable({
				...opts,
				onlySelf: true
			});
		});
		this._updateValue();
		const sourceControl = opts.sourceControl ?? this;
		if (opts.emitEvent !== false) {
			this._events.next(new ValueChangeEvent(this.value, sourceControl));
			this._events.next(new StatusChangeEvent(this.status, sourceControl));
			this.valueChanges.emit(this.value);
			this.statusChanges.emit(this.status);
		}
		this._updateAncestors({
			...opts,
			skipPristineCheck
		}, this);
		this._onDisabledChange.forEach((changeFn) => changeFn(true));
	}
	enable(opts = {}) {
		const skipPristineCheck = this._parentMarkedDirty(opts.onlySelf);
		this.status = VALID;
		this._forEachChild((control) => {
			control.enable({
				...opts,
				onlySelf: true
			});
		});
		this.updateValueAndValidity({
			onlySelf: true,
			emitEvent: opts.emitEvent
		});
		this._updateAncestors({
			...opts,
			skipPristineCheck
		}, this);
		this._onDisabledChange.forEach((changeFn) => changeFn(false));
	}
	_updateAncestors(opts, sourceControl) {
		if (!opts.onlySelf) {
			this._parent?.updateValueAndValidity(opts);
			if (!opts.skipPristineCheck) this._parent?._updatePristine({}, sourceControl);
			this._parent?._updateTouched({}, sourceControl);
		}
	}
	setParent(parent) {
		this._parent = parent;
	}
	getRawValue() {
		return this.value;
	}
	updateValueAndValidity(opts = {}) {
		this._setInitialStatus();
		this._updateValue();
		if (this.enabled) {
			const shouldHaveEmitted = this._cancelExistingSubscription();
			this.errors = this._runValidator();
			this.status = this._calculateStatus();
			if (this.status === VALID || this.status === PENDING) this._runAsyncValidator(shouldHaveEmitted, opts.emitEvent);
		}
		const sourceControl = opts.sourceControl ?? this;
		if (opts.emitEvent !== false) {
			this._events.next(new ValueChangeEvent(this.value, sourceControl));
			this._events.next(new StatusChangeEvent(this.status, sourceControl));
			this.valueChanges.emit(this.value);
			this.statusChanges.emit(this.status);
		}
		if (!opts.onlySelf) this._parent?.updateValueAndValidity({
			...opts,
			sourceControl
		});
	}
	_updateTreeValidity(opts = { emitEvent: true }) {
		this._forEachChild((ctrl) => ctrl._updateTreeValidity(opts));
		this.updateValueAndValidity({
			onlySelf: true,
			emitEvent: opts.emitEvent
		});
	}
	_setInitialStatus() {
		this.status = this._allControlsDisabled() ? DISABLED : VALID;
	}
	_runValidator() {
		return this.validator ? this.validator(this) : null;
	}
	_runAsyncValidator(shouldHaveEmitted, emitEvent) {
		if (this.asyncValidator) {
			this.status = PENDING;
			this._hasOwnPendingAsyncValidator = {
				emitEvent: emitEvent !== false,
				shouldHaveEmitted: shouldHaveEmitted !== false
			};
			const obs = toObservable(this.asyncValidator(this));
			this._asyncValidationSubscription = obs.subscribe((errors) => {
				this._hasOwnPendingAsyncValidator = null;
				this.setErrors(errors, {
					emitEvent,
					shouldHaveEmitted
				});
			});
		}
	}
	_cancelExistingSubscription() {
		if (this._asyncValidationSubscription) {
			this._asyncValidationSubscription.unsubscribe();
			const shouldHaveEmitted = (this._hasOwnPendingAsyncValidator?.emitEvent || this._hasOwnPendingAsyncValidator?.shouldHaveEmitted) ?? false;
			this._hasOwnPendingAsyncValidator = null;
			return shouldHaveEmitted;
		}
		return false;
	}
	setErrors(errors, opts = {}) {
		this.errors = errors;
		this._updateControlsErrors(opts.emitEvent !== false, this, opts.shouldHaveEmitted);
	}
	get(path) {
		let currPath = path;
		if (currPath == null) return null;
		if (!Array.isArray(currPath)) currPath = currPath.split(".");
		if (currPath.length === 0) return null;
		return currPath.reduce((control, name) => control && control._find(name), this);
	}
	getError(errorCode, path) {
		const control = path ? this.get(path) : this;
		return control?.errors ? control.errors[errorCode] : null;
	}
	hasError(errorCode, path) {
		return !!this.getError(errorCode, path);
	}
	get root() {
		let x = this;
		while (x._parent) x = x._parent;
		return x;
	}
	_updateControlsErrors(emitEvent, changedControl, shouldHaveEmitted) {
		this.status = this._calculateStatus();
		if (emitEvent) this.statusChanges.emit(this.status);
		if (emitEvent || shouldHaveEmitted) this._events.next(new StatusChangeEvent(this.status, changedControl));
		if (this._parent) this._parent._updateControlsErrors(emitEvent, changedControl, shouldHaveEmitted);
	}
	_initObservables() {
		this.valueChanges = new EventEmitter();
		this.statusChanges = new EventEmitter();
	}
	_calculateStatus() {
		if (this._allControlsDisabled()) return DISABLED;
		if (this.errors) return INVALID;
		if (this._hasOwnPendingAsyncValidator || this._anyControlsHaveStatus(PENDING)) return PENDING;
		if (this._anyControlsHaveStatus(INVALID)) return INVALID;
		return VALID;
	}
	_anyControlsHaveStatus(status) {
		return this._anyControls((control) => control.status === status);
	}
	_anyControlsDirty() {
		return this._anyControls((control) => control.dirty);
	}
	_anyControlsTouched() {
		return this._anyControls((control) => control.touched);
	}
	_updatePristine(opts, changedControl) {
		const newPristine = !this._anyControlsDirty();
		const changed = this.pristine !== newPristine;
		this.pristine = newPristine;
		if (!opts.onlySelf) this._parent?._updatePristine(opts, changedControl);
		if (changed) this._events.next(new PristineChangeEvent(this.pristine, changedControl));
	}
	_updateTouched(opts = {}, changedControl) {
		this.touched = this._anyControlsTouched();
		this._events.next(new TouchedChangeEvent(this.touched, changedControl));
		if (!opts.onlySelf) this._parent?._updateTouched(opts, changedControl);
	}
	_onDisabledChange = [];
	_registerOnCollectionChange(fn) {
		this._onCollectionChange = fn;
	}
	_setUpdateStrategy(opts) {
		if (isOptionsObj(opts) && opts.updateOn != null) this._updateOn = opts.updateOn;
	}
	_parentMarkedDirty(onlySelf) {
		return !onlySelf && !!this._parent?.dirty && !this._parent._anyControlsDirty();
	}
	_find(name) {
		return null;
	}
	_assignValidators(validators) {
		this._rawValidators = Array.isArray(validators) ? validators.slice() : validators;
		this._composedValidatorFn = coerceToValidator(this._rawValidators);
		this._updateHasRequiredValidator();
	}
	_assignAsyncValidators(validators) {
		this._rawAsyncValidators = Array.isArray(validators) ? validators.slice() : validators;
		this._composedAsyncValidatorFn = coerceToAsyncValidator(this._rawAsyncValidators);
	}
	_updateHasRequiredValidator() {
		untracked(() => this._hasRequired.set(this.hasValidator(Validators.required)));
	}
};
function hasOwnControl(controls, name) {
	return Object.hasOwn(controls, name);
}
function isNativeFormElement(element) {
	return element.tagName === "INPUT" || element.tagName === "SELECT" || element.tagName === "TEXTAREA";
}
function setNativeDomProperty(renderer, element, name, value) {
	switch (name) {
		case "name":
			renderer.setAttribute(element, name, value);
			break;
		case "disabled":
		case "readonly":
		case "required":
			if (value) renderer.setAttribute(element, name, "");
			else renderer.removeAttribute(element, name);
			break;
		case "max":
		case "min":
		case "minLength":
		case "maxLength":
			if (value !== void 0) renderer.setAttribute(element, name, value.toString());
			else renderer.removeAttribute(element, name);
			break;
	}
}
var ReactiveValidationError = class {
	kind;
	context;
	control;
	message;
	constructor({ kind, context, control }) {
		this.kind = kind;
		this.context = context;
		this.control = control;
	}
};
function toInteger(value) {
	return typeof value === "number" ? value : parseInt(value, 10);
}
function toFloat(value) {
	return typeof value === "number" ? value : parseFloat(value);
}
var AbstractValidatorDirective = class AbstractValidatorDirective {
	_validator = nullValidator;
	_onChange;
	_enabled;
	ngOnChanges(changes) {
		if (this.inputName in changes) {
			const input = this.normalizeInput(changes[this.inputName].currentValue);
			this._enabled = this.enabled(input);
			this._validator = this._enabled ? this.createValidator(input) : nullValidator;
			this._onChange?.();
		}
	}
	validate(control) {
		return this._validator(control);
	}
	registerOnValidatorChange(fn) {
		this._onChange = fn;
	}
	enabled(input) {
		return input != null;
	}
	static ɵfac = function AbstractValidatorDirective_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || AbstractValidatorDirective)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: AbstractValidatorDirective,
		features: [ɵɵNgOnChangesFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AbstractValidatorDirective, [{ type: Directive }], null, null);
})();
var MAX_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => MaxValidator),
	multi: true
};
var MaxValidator = class MaxValidator extends AbstractValidatorDirective {
	max;
	inputName = "max";
	normalizeInput = (input) => toFloat(input);
	createValidator = (max) => maxValidator(max);
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMaxValidator_BaseFactory;
		return function MaxValidator_Factory(__ngFactoryType__) {
			return (ɵMaxValidator_BaseFactory || (ɵMaxValidator_BaseFactory = ɵɵgetInheritedFactory(MaxValidator)))(__ngFactoryType__ || MaxValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MaxValidator,
		selectors: [
			[
				"input",
				"type",
				"number",
				"max",
				"",
				"formControlName",
				""
			],
			[
				"input",
				"type",
				"number",
				"max",
				"",
				"formControl",
				""
			],
			[
				"input",
				"type",
				"number",
				"max",
				"",
				"ngModel",
				""
			]
		],
		hostVars: 1,
		hostBindings: function MaxValidator_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("max", ctx._enabled ? ctx.max : null);
		},
		inputs: { max: "max" },
		standalone: false,
		features: [ɵɵProvidersFeature([MAX_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MaxValidator, [{
		type: Directive,
		args: [{
			selector: "input[type=number][max][formControlName],input[type=number][max][formControl],input[type=number][max][ngModel]",
			providers: [MAX_VALIDATOR],
			host: { "[attr.max]": "_enabled ? max : null" },
			standalone: false
		}]
	}], null, { max: [{ type: Input }] });
})();
var MIN_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => MinValidator),
	multi: true
};
var MinValidator = class MinValidator extends AbstractValidatorDirective {
	min;
	inputName = "min";
	normalizeInput = (input) => toFloat(input);
	createValidator = (min) => minValidator(min);
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMinValidator_BaseFactory;
		return function MinValidator_Factory(__ngFactoryType__) {
			return (ɵMinValidator_BaseFactory || (ɵMinValidator_BaseFactory = ɵɵgetInheritedFactory(MinValidator)))(__ngFactoryType__ || MinValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MinValidator,
		selectors: [
			[
				"input",
				"type",
				"number",
				"min",
				"",
				"formControlName",
				""
			],
			[
				"input",
				"type",
				"number",
				"min",
				"",
				"formControl",
				""
			],
			[
				"input",
				"type",
				"number",
				"min",
				"",
				"ngModel",
				""
			]
		],
		hostVars: 1,
		hostBindings: function MinValidator_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("min", ctx._enabled ? ctx.min : null);
		},
		inputs: { min: "min" },
		standalone: false,
		features: [ɵɵProvidersFeature([MIN_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MinValidator, [{
		type: Directive,
		args: [{
			selector: "input[type=number][min][formControlName],input[type=number][min][formControl],input[type=number][min][ngModel]",
			providers: [MIN_VALIDATOR],
			host: { "[attr.min]": "_enabled ? min : null" },
			standalone: false
		}]
	}], null, { min: [{ type: Input }] });
})();
var REQUIRED_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => RequiredValidator),
	multi: true
};
var CHECKBOX_REQUIRED_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => CheckboxRequiredValidator),
	multi: true
};
var RequiredValidator = class RequiredValidator extends AbstractValidatorDirective {
	required;
	inputName = "required";
	normalizeInput = booleanAttribute;
	createValidator = (input) => requiredValidator;
	enabled(input) {
		return input;
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵRequiredValidator_BaseFactory;
		return function RequiredValidator_Factory(__ngFactoryType__) {
			return (ɵRequiredValidator_BaseFactory || (ɵRequiredValidator_BaseFactory = ɵɵgetInheritedFactory(RequiredValidator)))(__ngFactoryType__ || RequiredValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: RequiredValidator,
		selectors: [
			[
				"",
				"required",
				"",
				"formControlName",
				"",
				3,
				"type",
				"checkbox"
			],
			[
				"",
				"required",
				"",
				"formControl",
				"",
				3,
				"type",
				"checkbox"
			],
			[
				"",
				"required",
				"",
				"ngModel",
				"",
				3,
				"type",
				"checkbox"
			]
		],
		hostVars: 1,
		hostBindings: function RequiredValidator_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("required", ctx._enabled ? "" : null);
		},
		inputs: { required: "required" },
		standalone: false,
		features: [ɵɵProvidersFeature([REQUIRED_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(RequiredValidator, [{
		type: Directive,
		args: [{
			selector: ":not([type=checkbox])[required][formControlName],:not([type=checkbox])[required][formControl],:not([type=checkbox])[required][ngModel]",
			providers: [REQUIRED_VALIDATOR],
			host: { "[attr.required]": "_enabled ? \"\" : null" },
			standalone: false
		}]
	}], null, { required: [{ type: Input }] });
})();
var CheckboxRequiredValidator = class CheckboxRequiredValidator extends RequiredValidator {
	createValidator = (input) => requiredTrueValidator;
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵCheckboxRequiredValidator_BaseFactory;
		return function CheckboxRequiredValidator_Factory(__ngFactoryType__) {
			return (ɵCheckboxRequiredValidator_BaseFactory || (ɵCheckboxRequiredValidator_BaseFactory = ɵɵgetInheritedFactory(CheckboxRequiredValidator)))(__ngFactoryType__ || CheckboxRequiredValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: CheckboxRequiredValidator,
		selectors: [
			[
				"input",
				"type",
				"checkbox",
				"required",
				"",
				"formControlName",
				""
			],
			[
				"input",
				"type",
				"checkbox",
				"required",
				"",
				"formControl",
				""
			],
			[
				"input",
				"type",
				"checkbox",
				"required",
				"",
				"ngModel",
				""
			]
		],
		hostVars: 1,
		hostBindings: function CheckboxRequiredValidator_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("required", ctx._enabled ? "" : null);
		},
		standalone: false,
		features: [ɵɵProvidersFeature([CHECKBOX_REQUIRED_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CheckboxRequiredValidator, [{
		type: Directive,
		args: [{
			selector: "input[type=checkbox][required][formControlName],input[type=checkbox][required][formControl],input[type=checkbox][required][ngModel]",
			providers: [CHECKBOX_REQUIRED_VALIDATOR],
			host: { "[attr.required]": "_enabled ? \"\" : null" },
			standalone: false
		}]
	}], null, null);
})();
var EMAIL_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => EmailValidator),
	multi: true
};
var EmailValidator = class EmailValidator extends AbstractValidatorDirective {
	email;
	inputName = "email";
	normalizeInput = booleanAttribute;
	createValidator = (input) => emailValidator;
	enabled(input) {
		return input;
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵEmailValidator_BaseFactory;
		return function EmailValidator_Factory(__ngFactoryType__) {
			return (ɵEmailValidator_BaseFactory || (ɵEmailValidator_BaseFactory = ɵɵgetInheritedFactory(EmailValidator)))(__ngFactoryType__ || EmailValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: EmailValidator,
		selectors: [
			[
				"",
				"email",
				"",
				"formControlName",
				""
			],
			[
				"",
				"email",
				"",
				"formControl",
				""
			],
			[
				"",
				"email",
				"",
				"ngModel",
				""
			]
		],
		inputs: { email: "email" },
		standalone: false,
		features: [ɵɵProvidersFeature([EMAIL_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(EmailValidator, [{
		type: Directive,
		args: [{
			selector: "[email][formControlName],[email][formControl],[email][ngModel]",
			providers: [EMAIL_VALIDATOR],
			standalone: false
		}]
	}], null, { email: [{ type: Input }] });
})();
var MIN_LENGTH_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => MinLengthValidator),
	multi: true
};
var MinLengthValidator = class MinLengthValidator extends AbstractValidatorDirective {
	minlength;
	inputName = "minlength";
	normalizeInput = (input) => toInteger(input);
	createValidator = (minlength) => minLengthValidator(minlength);
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMinLengthValidator_BaseFactory;
		return function MinLengthValidator_Factory(__ngFactoryType__) {
			return (ɵMinLengthValidator_BaseFactory || (ɵMinLengthValidator_BaseFactory = ɵɵgetInheritedFactory(MinLengthValidator)))(__ngFactoryType__ || MinLengthValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MinLengthValidator,
		selectors: [
			[
				"",
				"minlength",
				"",
				"formControlName",
				""
			],
			[
				"",
				"minlength",
				"",
				"formControl",
				""
			],
			[
				"",
				"minlength",
				"",
				"ngModel",
				""
			]
		],
		hostVars: 1,
		hostBindings: function MinLengthValidator_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("minlength", ctx._enabled ? ctx.minlength : null);
		},
		inputs: { minlength: "minlength" },
		standalone: false,
		features: [ɵɵProvidersFeature([MIN_LENGTH_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MinLengthValidator, [{
		type: Directive,
		args: [{
			selector: "[minlength][formControlName],[minlength][formControl],[minlength][ngModel]",
			providers: [MIN_LENGTH_VALIDATOR],
			host: { "[attr.minlength]": "_enabled ? minlength : null" },
			standalone: false
		}]
	}], null, { minlength: [{ type: Input }] });
})();
var MAX_LENGTH_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => MaxLengthValidator),
	multi: true
};
var MaxLengthValidator = class MaxLengthValidator extends AbstractValidatorDirective {
	maxlength;
	inputName = "maxlength";
	normalizeInput = (input) => toInteger(input);
	createValidator = (maxlength) => maxLengthValidator(maxlength);
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMaxLengthValidator_BaseFactory;
		return function MaxLengthValidator_Factory(__ngFactoryType__) {
			return (ɵMaxLengthValidator_BaseFactory || (ɵMaxLengthValidator_BaseFactory = ɵɵgetInheritedFactory(MaxLengthValidator)))(__ngFactoryType__ || MaxLengthValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MaxLengthValidator,
		selectors: [
			[
				"",
				"maxlength",
				"",
				"formControlName",
				""
			],
			[
				"",
				"maxlength",
				"",
				"formControl",
				""
			],
			[
				"",
				"maxlength",
				"",
				"ngModel",
				""
			]
		],
		hostVars: 1,
		hostBindings: function MaxLengthValidator_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("maxlength", ctx._enabled ? ctx.maxlength : null);
		},
		inputs: { maxlength: "maxlength" },
		standalone: false,
		features: [ɵɵProvidersFeature([MAX_LENGTH_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MaxLengthValidator, [{
		type: Directive,
		args: [{
			selector: "[maxlength][formControlName],[maxlength][formControl],[maxlength][ngModel]",
			providers: [MAX_LENGTH_VALIDATOR],
			host: { "[attr.maxlength]": "_enabled ? maxlength : null" },
			standalone: false
		}]
	}], null, { maxlength: [{ type: Input }] });
})();
var PATTERN_VALIDATOR = {
	provide: NG_VALIDATORS,
	useExisting: forwardRef(() => PatternValidator),
	multi: true
};
var PatternValidator = class PatternValidator extends AbstractValidatorDirective {
	pattern;
	inputName = "pattern";
	normalizeInput = (input) => input;
	createValidator = (input) => patternValidator(input);
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵPatternValidator_BaseFactory;
		return function PatternValidator_Factory(__ngFactoryType__) {
			return (ɵPatternValidator_BaseFactory || (ɵPatternValidator_BaseFactory = ɵɵgetInheritedFactory(PatternValidator)))(__ngFactoryType__ || PatternValidator);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: PatternValidator,
		selectors: [
			[
				"",
				"pattern",
				"",
				"formControlName",
				""
			],
			[
				"",
				"pattern",
				"",
				"formControl",
				""
			],
			[
				"",
				"pattern",
				"",
				"ngModel",
				""
			]
		],
		hostVars: 1,
		hostBindings: function PatternValidator_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("pattern", ctx._enabled ? ctx.pattern : null);
		},
		inputs: { pattern: "pattern" },
		standalone: false,
		features: [ɵɵProvidersFeature([PATTERN_VALIDATOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PatternValidator, [{
		type: Directive,
		args: [{
			selector: "[pattern][formControlName],[pattern][formControl],[pattern][ngModel]",
			providers: [PATTERN_VALIDATOR],
			host: { "[attr.pattern]": "_enabled ? pattern : null" },
			standalone: false
		}]
	}], null, { pattern: [{ type: Input }] });
})();
var ɵFORM_CONTROL_INTEGRATION = new InjectionToken(typeof ngDevMode !== "undefined" && ngDevMode ? "FORM_CONTROL_INTEGRATION" : "");
var CALL_SET_DISABLED_STATE = new InjectionToken(typeof ngDevMode === "undefined" || ngDevMode ? "CallSetDisabledState" : "", { factory: () => setDisabledStateDefault });
var setDisabledStateDefault = "always";
function controlPath(name, parent) {
	return [...parent.path, name];
}
function setUpControlValueAccessor(control, dir, callSetDisabledState = setDisabledStateDefault) {
	if (typeof ngDevMode === "undefined" || ngDevMode) {
		if (!control) _throwError(dir, "Cannot find control with");
		if (!dir.valueAccessor) _throwMissingValueAccessorError(dir);
	}
	setUpValidators(control, dir);
	dir.valueAccessor.writeValue(control.value);
	if (control.disabled || callSetDisabledState === "always") dir.valueAccessor.setDisabledState?.(control.disabled);
	setUpViewChangePipeline(control, dir);
	setUpModelChangePipeline(control, dir);
	setUpBlurPipeline(control, dir);
	setUpDisabledChangeHandler(control, dir);
}
function cleanUpControl(control, dir, validateControlPresenceOnChange = true) {
	const noop = () => {
		if (validateControlPresenceOnChange && (typeof ngDevMode === "undefined" || ngDevMode)) _noControlError(dir);
	};
	dir?.valueAccessor?.registerOnChange(noop);
	dir?.valueAccessor?.registerOnTouched(noop);
	cleanUpValidators(control, dir);
	if (control) {
		dir._invokeOnDestroyCallbacks();
		control._registerOnCollectionChange(() => {});
	}
}
function registerOnValidatorChange(validators, onChange) {
	validators.forEach((validator) => {
		if (validator.registerOnValidatorChange) validator.registerOnValidatorChange(onChange);
	});
}
function setUpDisabledChangeHandler(control, dir) {
	if (dir.valueAccessor.setDisabledState) {
		const onDisabledChange = (isDisabled) => {
			dir.valueAccessor.setDisabledState(isDisabled);
		};
		control.registerOnDisabledChange(onDisabledChange);
		dir._registerOnDestroy(() => {
			control._unregisterOnDisabledChange(onDisabledChange);
		});
	}
}
function setUpValidators(control, dir) {
	const validators = getControlValidators(control);
	if (dir.validator !== null) control.setValidators(mergeValidators(validators, dir.validator));
	else if (typeof validators === "function") control.setValidators([validators]);
	const asyncValidators = getControlAsyncValidators(control);
	if (dir.asyncValidator !== null) control.setAsyncValidators(mergeValidators(asyncValidators, dir.asyncValidator));
	else if (typeof asyncValidators === "function") control.setAsyncValidators([asyncValidators]);
	const onValidatorChange = () => control.updateValueAndValidity();
	registerOnValidatorChange(dir._rawValidators, onValidatorChange);
	registerOnValidatorChange(dir._rawAsyncValidators, onValidatorChange);
}
function cleanUpValidators(control, dir) {
	let isControlUpdated = false;
	if (control !== null) {
		if (dir.validator !== null) {
			const validators = getControlValidators(control);
			if (Array.isArray(validators) && validators.length > 0) {
				const updatedValidators = validators.filter((validator) => validator !== dir.validator);
				if (updatedValidators.length !== validators.length) {
					isControlUpdated = true;
					control.setValidators(updatedValidators);
				}
			}
		}
		if (dir.asyncValidator !== null) {
			const asyncValidators = getControlAsyncValidators(control);
			if (Array.isArray(asyncValidators) && asyncValidators.length > 0) {
				const updatedAsyncValidators = asyncValidators.filter((asyncValidator) => asyncValidator !== dir.asyncValidator);
				if (updatedAsyncValidators.length !== asyncValidators.length) {
					isControlUpdated = true;
					control.setAsyncValidators(updatedAsyncValidators);
				}
			}
		}
	}
	const noop = () => {};
	registerOnValidatorChange(dir._rawValidators, noop);
	registerOnValidatorChange(dir._rawAsyncValidators, noop);
	return isControlUpdated;
}
function setUpViewChangePipeline(control, dir) {
	dir.valueAccessor.registerOnChange((newValue) => {
		control._pendingValue = newValue;
		control._pendingChange = true;
		control._pendingDirty = true;
		if (control.updateOn === "change") updateControl(control, dir);
	});
}
function setUpBlurPipeline(control, dir) {
	dir.valueAccessor.registerOnTouched(() => {
		control._pendingTouched = true;
		if (control.updateOn === "blur" && control._pendingChange) updateControl(control, dir);
		if (control.updateOn !== "submit") control.markAsTouched();
	});
}
function updateControl(control, dir) {
	if (control._pendingDirty) control.markAsDirty();
	control.setValue(control._pendingValue, { emitModelToViewChange: false });
	dir.viewToModelUpdate(control._pendingValue);
	control._pendingChange = false;
}
function setUpModelChangePipeline(control, dir) {
	const onChange = (newValue, emitModelEvent) => {
		dir.valueAccessor.writeValue(newValue);
		if (emitModelEvent) dir.viewToModelUpdate(newValue);
	};
	control.registerOnChange(onChange);
	dir._registerOnDestroy(() => {
		control._unregisterOnChange(onChange);
	});
}
function setUpFormContainer(control, dir) {
	if (control == null && (typeof ngDevMode === "undefined" || ngDevMode)) _throwError(dir, "Cannot find control with");
	setUpValidators(control, dir);
}
function cleanUpFormContainer(control, dir) {
	return cleanUpValidators(control, dir);
}
function _noControlError(dir) {
	return _throwError(dir, "There is no FormControl instance attached to form control element with");
}
function _throwError(dir, message) {
	const messageEnd = _describeControlLocation(dir);
	throw new Error(`${message} ${messageEnd}`);
}
function _describeControlLocation(dir) {
	const path = dir.path;
	if (path && path.length > 1) return `path: '${path.join(" -> ")}'`;
	if (path?.[0]) return `name: '${path}'`;
	return "unspecified name attribute";
}
function _throwMissingValueAccessorError(dir) {
	throw new RuntimeError(-1203, `No value accessor for form control ${_describeControlLocation(dir)}.`);
}
function _throwInvalidValueAccessorError(dir) {
	throw new RuntimeError(1200, `Value accessor was not provided as an array for form control with ${_describeControlLocation(dir)}. Check that the \`NG_VALUE_ACCESSOR\` token is configured as a \`multi: true\` provider.`);
}
function isPropertyUpdated(changes, viewModel) {
	if (!changes.hasOwnProperty("model")) return false;
	const change = changes["model"];
	if (change.isFirstChange()) return true;
	return !Object.is(viewModel, change.currentValue);
}
function isBuiltInAccessor(valueAccessor) {
	return Object.getPrototypeOf(valueAccessor.constructor) === BuiltInControlValueAccessor;
}
function syncPendingControls(form, directives) {
	form._syncPendingControls();
	directives.forEach((dir) => {
		const control = dir.control;
		if (control.updateOn === "submit" && control._pendingChange) {
			dir.viewToModelUpdate(control._pendingValue);
			control._pendingChange = false;
		}
	});
}
function selectValueAccessor(dir, valueAccessors) {
	if (!valueAccessors) return null;
	if (!Array.isArray(valueAccessors) && (typeof ngDevMode === "undefined" || ngDevMode)) _throwInvalidValueAccessorError(dir);
	let defaultAccessor = void 0;
	let builtinAccessor = void 0;
	let customAccessor = void 0;
	valueAccessors.forEach((v) => {
		if (v.constructor === DefaultValueAccessor) defaultAccessor = v;
		else if (isBuiltInAccessor(v)) {
			if (builtinAccessor && (typeof ngDevMode === "undefined" || ngDevMode)) _throwError(dir, "More than one built-in value accessor matches form control with");
			builtinAccessor = v;
		} else {
			if (customAccessor && (typeof ngDevMode === "undefined" || ngDevMode)) _throwError(dir, "More than one custom value accessor matches form control with");
			customAccessor = v;
		}
	});
	if (customAccessor) return customAccessor;
	if (builtinAccessor) return builtinAccessor;
	if (defaultAccessor) return defaultAccessor;
	if (typeof ngDevMode === "undefined" || ngDevMode) _throwError(dir, "No valid value accessor for form control with");
	return null;
}
function removeListItem$1(list, el) {
	const index = list.indexOf(el);
	if (index > -1) list.splice(index, 1);
}
function _ngModelWarning(name, type, instance, warningConfig) {
	if (warningConfig === "never") return;
	if ((warningConfig === null || warningConfig === "once") && !type._ngModelWarningSentOnce || warningConfig === "always" && !instance._ngModelWarningSent) {
		console.warn(ngModelWarning(name));
		type._ngModelWarningSentOnce = true;
		instance._ngModelWarningSent = true;
	}
}
var NG_CONTROL_INTEGRATION_PROVIDER = {
	provide: ɵFORM_CONTROL_INTEGRATION,
	useFactory: () => {
		const control = inject(NgControl, { self: true });
		return {
			setParseErrors: (source) => {
				control.setParseErrorSource(source);
			},
			set onReset(callback) {
				control.onReset = callback;
			}
		};
	}
};
var NgControl = class extends AbstractControlDirective {
	_parent = null;
	name = null;
	valueAccessor = null;
	isCustomControlBased = false;
	userOnReset;
	resetSubscription;
	set onReset(callback) {
		this.userOnReset = callback;
		this.resetSubscription?.unsubscribe();
		this.resetSubscription = void 0;
		if (this.control) {
			this.resetSubscription = this.control.events.subscribe((event) => {
				if (event instanceof FormResetEvent && this.control) this.userOnReset?.(this.control.value);
			});
			this.subscription?.add(this.resetSubscription);
		}
	}
	isNativeFormElement = false;
	rawValueAccessors;
	_selectedValueAccessor = null;
	get selectedValueAccessor() {
		return this._selectedValueAccessor ??= selectValueAccessor(this, this.rawValueAccessors);
	}
	parseErrorsValidator = null;
	renderer;
	injector;
	requiredValidatorViaDi;
	subscription;
	customControlBindings = null;
	constructor(injector, renderer, rawValueAccessors) {
		super();
		this.injector = injector;
		this.renderer = renderer;
		this.rawValueAccessors = rawValueAccessors;
		this.injector?.get(DestroyRef)?.onDestroy(() => {
			this.removeParseErrorsValidator(this.control);
			this.subscription?.unsubscribe();
		});
	}
	setupCustomControl() {
		this.subscription?.unsubscribe();
		const cdr = this.injector?.get(ChangeDetectorRef);
		if (!this.control || !cdr) return;
		const markForCheck = cdr.markForCheck.bind(cdr);
		this.subscription = new Subscription();
		this.subscription.add(this.control.valueChanges.subscribe(markForCheck));
		this.subscription.add(this.control.statusChanges.subscribe(markForCheck));
		this.resetSubscription?.unsubscribe();
		this.resetSubscription = void 0;
		if (this.userOnReset) {
			this.resetSubscription = this.control.events.subscribe((event) => {
				if (event instanceof FormResetEvent && this.control) this.userOnReset?.(this.control.value);
			});
			this.subscription.add(this.resetSubscription);
		}
		if (this.parseErrorsValidator) this.control.addValidators(this.parseErrorsValidator);
	}
	ngControlCreate(host) {
		if (!host.nativeElement.hasAttribute?.("ngNoCva") && (this.rawValueAccessors && this.rawValueAccessors.length > 0 || this.valueAccessor !== null) || !host.customControl) return;
		this.isCustomControlBased = true;
		host.listenToCustomControlModel((value) => {
			this.control?.setValue(value, { emitModelToViewChange: false });
			this.control?.markAsDirty();
			this.viewToModelUpdate(value);
		});
		host.listenToCustomControlOutput("touch", () => {
			this.control?.markAsTouched();
		});
		this.customControlBindings = {};
		this.isNativeFormElement = isNativeFormElement(host.nativeElement);
		this.requiredValidatorViaDi = this._rawValidators.find((v) => v instanceof RequiredValidator);
	}
	ngControlUpdate(host, bindRequired) {
		if (!this.isCustomControlBased) return;
		const control = this.control;
		const bindings = this.customControlBindings;
		if (!Object.is(bindings.value, control.value)) {
			bindings.value = control.value;
			host.setCustomControlModelInput(control.value);
		}
		this.bindControlProperty(host, bindings, "touched", control.touched);
		this.bindControlProperty(host, bindings, "dirty", control.dirty);
		this.bindControlProperty(host, bindings, "valid", control.valid);
		this.bindControlProperty(host, bindings, "invalid", control.invalid);
		this.bindControlProperty(host, bindings, "pending", control.pending);
		this.bindControlProperty(host, bindings, "disabled", control.disabled);
		if (this.shouldBindRequired) this.bindControlProperty(host, bindings, "required", this.isRequired);
		const errorObject = control.errors;
		if (bindings.errors !== errorObject) {
			bindings.errors = errorObject;
			const errorArray = this._convertErrors(errorObject);
			host.setInputOnDirectives("errors", errorArray);
		}
	}
	get isRequired() {
		return (this.requiredValidatorViaDi?._enabled || this.control?._hasRequired()) ?? false;
	}
	get shouldBindRequired() {
		return true;
	}
	bindControlProperty(host, bindings, name, value) {
		if (bindings[name] === value) return;
		bindings[name] = value;
		const wasSet = host.setInputOnDirectives(name, value);
		if (this.isNativeFormElement && !wasSet && (name === "disabled" || name === "required") && this.renderer) setNativeDomProperty(this.renderer, host.nativeElement, name, value);
	}
	_convertErrors(errors) {
		if (errors === null) return [];
		const control = this.control;
		return Object.entries(errors).map(([kind, context]) => {
			return new ReactiveValidationError({
				context,
				kind,
				control
			});
		});
	}
	setParseErrorSource(parseErrors) {
		if (parseErrors === void 0) return;
		let convertedErrors = null;
		const convertedParseErrors = computed(() => {
			const rawErrors = parseErrors();
			if (rawErrors.length === 0) return null;
			return rawErrors.reduce((acc, err) => {
				acc[err.kind] = err;
				return acc;
			}, {});
		}, ...ngDevMode ? [{ debugName: "convertedParseErrors" }] : []);
		this.parseErrorsValidator = (() => convertedErrors).bind(this);
		effect(() => {
			convertedErrors = convertedParseErrors();
			this.control?.updateValueAndValidity({ emitEvent: false });
		}, { injector: this.injector });
	}
	removeParseErrorsValidator(control) {
		if (this.parseErrorsValidator) {
			control?.removeValidators(this.parseErrorsValidator);
			control?.updateValueAndValidity({ emitEvent: false });
		}
	}
};
var AbstractControlStatus = class {
	_cd;
	constructor(cd) {
		this._cd = cd;
	}
	get isTouched() {
		this._cd?.control?._touched?.();
		return !!this._cd?.control?.touched;
	}
	get isUntouched() {
		return !!this._cd?.control?.untouched;
	}
	get isPristine() {
		this._cd?.control?._pristine?.();
		return !!this._cd?.control?.pristine;
	}
	get isDirty() {
		return !!this._cd?.control?.dirty;
	}
	get isValid() {
		this._cd?.control?._status?.();
		return !!this._cd?.control?.valid;
	}
	get isInvalid() {
		return !!this._cd?.control?.invalid;
	}
	get isPending() {
		return !!this._cd?.control?.pending;
	}
	get isSubmitted() {
		this._cd?._submitted?.();
		return !!this._cd?.submitted;
	}
};
var ngControlStatusHost = {
	"[class.ng-untouched]": "isUntouched",
	"[class.ng-touched]": "isTouched",
	"[class.ng-pristine]": "isPristine",
	"[class.ng-dirty]": "isDirty",
	"[class.ng-valid]": "isValid",
	"[class.ng-invalid]": "isInvalid",
	"[class.ng-pending]": "isPending"
};
var NgControlStatus = class NgControlStatus extends AbstractControlStatus {
	constructor(cd) {
		super(cd);
	}
	static ɵfac = function NgControlStatus_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || NgControlStatus)(ɵɵdirectiveInject(NgControl, 2));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: NgControlStatus,
		selectors: [
			[
				"",
				"formControlName",
				""
			],
			[
				"",
				"ngModel",
				""
			],
			[
				"",
				"formControl",
				""
			]
		],
		hostVars: 14,
		hostBindings: function NgControlStatus_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵclassProp("ng-untouched", ctx.isUntouched)("ng-touched", ctx.isTouched)("ng-pristine", ctx.isPristine)("ng-dirty", ctx.isDirty)("ng-valid", ctx.isValid)("ng-invalid", ctx.isInvalid)("ng-pending", ctx.isPending);
		},
		standalone: false,
		features: [ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgControlStatus, [{
		type: Directive,
		args: [{
			selector: "[formControlName],[ngModel],[formControl]",
			host: ngControlStatusHost,
			standalone: false
		}]
	}], () => [{
		type: NgControl,
		decorators: [{ type: Self }]
	}], null);
})();
var NgControlStatusGroup = class NgControlStatusGroup extends AbstractControlStatus {
	constructor(cd) {
		super(cd);
	}
	static ɵfac = function NgControlStatusGroup_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || NgControlStatusGroup)(ɵɵdirectiveInject(ControlContainer, 10));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: NgControlStatusGroup,
		selectors: [
			[
				"",
				"formGroupName",
				""
			],
			[
				"",
				"formArrayName",
				""
			],
			[
				"",
				"ngModelGroup",
				""
			],
			[
				"",
				"formGroup",
				""
			],
			[
				"",
				"formArray",
				""
			],
			[
				"form",
				3,
				"ngNoForm",
				""
			],
			[
				"",
				"ngForm",
				""
			]
		],
		hostVars: 16,
		hostBindings: function NgControlStatusGroup_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵclassProp("ng-untouched", ctx.isUntouched)("ng-touched", ctx.isTouched)("ng-pristine", ctx.isPristine)("ng-dirty", ctx.isDirty)("ng-valid", ctx.isValid)("ng-invalid", ctx.isInvalid)("ng-pending", ctx.isPending)("ng-submitted", ctx.isSubmitted);
		},
		standalone: false,
		features: [ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgControlStatusGroup, [{
		type: Directive,
		args: [{
			selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]",
			host: {
				...ngControlStatusHost,
				"[class.ng-submitted]": "isSubmitted"
			},
			standalone: false
		}]
	}], () => [{
		type: ControlContainer,
		decorators: [{ type: Optional }, { type: Self }]
	}], null);
})();
var FormGroup = class extends AbstractControl {
	constructor(controls, validatorOrOpts, asyncValidator) {
		super(pickValidators(validatorOrOpts), pickAsyncValidators(asyncValidator, validatorOrOpts));
		(typeof ngDevMode === "undefined" || ngDevMode) && validateFormGroupControls(controls);
		this.controls = controls;
		this._initObservables();
		this._setUpdateStrategy(validatorOrOpts);
		this._setUpControls();
		this.updateValueAndValidity({
			onlySelf: true,
			emitEvent: !!this.asyncValidator
		});
	}
	controls;
	registerControl(name, control) {
		const existingControl = this._find(name);
		if (existingControl) return existingControl;
		this.controls[name] = control;
		control.setParent(this);
		control._registerOnCollectionChange(this._onCollectionChange);
		return control;
	}
	addControl(name, control, options = {}) {
		this.registerControl(name, control);
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
		this._onCollectionChange();
	}
	removeControl(name, options = {}) {
		const existingControl = this._find(name);
		if (existingControl) existingControl._registerOnCollectionChange(() => {});
		delete this.controls[name];
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
		this._onCollectionChange();
	}
	setControl(name, control, options = {}) {
		const existingControl = this._find(name);
		if (existingControl) existingControl._registerOnCollectionChange(() => {});
		delete this.controls[name];
		if (control) this.registerControl(name, control);
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
		this._onCollectionChange();
	}
	contains(controlName) {
		return this._find(controlName)?.enabled === true;
	}
	setValue(value, options = {}) {
		untracked(() => {
			assertAllValuesPresent(this, true, value);
			Object.keys(value).forEach((name) => {
				assertControlPresent(this, true, name);
				this.controls[name].setValue(value[name], {
					onlySelf: true,
					emitEvent: options.emitEvent
				});
			});
			this.updateValueAndValidity(options);
		});
	}
	patchValue(value, options = {}) {
		if (value == null) return;
		Object.keys(value).forEach((name) => {
			const existingControl = this._find(name);
			if (existingControl) existingControl.patchValue(value[name], {
				onlySelf: true,
				emitEvent: options.emitEvent
			});
		});
		this.updateValueAndValidity(options);
	}
	reset(value = {}, options = {}) {
		this._forEachChild((control, name) => {
			control.reset(value ? value[name] : null, {
				...options,
				onlySelf: true
			});
		});
		this._updatePristine(options, this);
		this._updateTouched(options, this);
		this.updateValueAndValidity(options);
		if (options?.emitEvent !== false) this._events.next(new FormResetEvent(this));
	}
	getRawValue() {
		return this._reduceChildren({}, (acc, control, name) => {
			acc[name] = control.getRawValue();
			return acc;
		});
	}
	_syncPendingControls() {
		let subtreeUpdated = this._reduceChildren(false, (updated, child) => {
			return child._syncPendingControls() ? true : updated;
		});
		if (subtreeUpdated) this.updateValueAndValidity({ onlySelf: true });
		return subtreeUpdated;
	}
	_forEachChild(cb) {
		Object.keys(this.controls).forEach((key) => {
			const control = this.controls[key];
			control && cb(control, key);
		});
	}
	_setUpControls() {
		this._forEachChild((control) => {
			control.setParent(this);
			control._registerOnCollectionChange(this._onCollectionChange);
		});
	}
	_updateValue() {
		this.value = this._reduceValue();
	}
	_anyControls(condition) {
		for (const [controlName, control] of Object.entries(this.controls)) if (this.contains(controlName) && condition(control)) return true;
		return false;
	}
	_reduceValue() {
		return this._reduceChildren({}, (acc, control, name) => {
			if (control.enabled || this.disabled) acc[name] = control.value;
			return acc;
		});
	}
	_reduceChildren(initValue, fn) {
		let res = initValue;
		this._forEachChild((control, name) => {
			res = fn(res, control, name);
		});
		return res;
	}
	_allControlsDisabled() {
		for (const controlName of Object.keys(this.controls)) if (this.controls[controlName].enabled) return false;
		return Object.keys(this.controls).length > 0 || this.disabled;
	}
	_find(name) {
		return hasOwnControl(this.controls, name) ? this.controls[name] : null;
	}
};
function validateFormGroupControls(controls) {
	const invalidKeys = Object.keys(controls).filter((key) => key.includes("."));
	if (invalidKeys.length > 0) console.warn(`FormGroup keys cannot include \`.\`, please replace the keys for: ${invalidKeys.join(",")}.`);
}
var FormRecord = class extends FormGroup {};
var formDirectiveProvider$2 = {
	provide: ControlContainer,
	useExisting: forwardRef(() => NgForm)
};
var resolvedPromise$1 = (() => Promise.resolve())();
var NgForm = class NgForm extends ControlContainer {
	callSetDisabledState;
	get submitted() {
		return untracked(this.submittedReactive);
	}
	_submitted = computed(() => this.submittedReactive(), ...ngDevMode ? [{ debugName: "_submitted" }] : []);
	submittedReactive = signal(false, ...ngDevMode ? [{ debugName: "submittedReactive" }] : []);
	_directives = /* @__PURE__ */ new Set();
	form;
	ngSubmit = new EventEmitter();
	options;
	constructor(validators, asyncValidators, callSetDisabledState) {
		super();
		this.callSetDisabledState = callSetDisabledState;
		this.form = new FormGroup({}, composeValidators(validators), composeAsyncValidators(asyncValidators));
	}
	ngAfterViewInit() {
		this._setUpdateStrategy();
	}
	get formDirective() {
		return this;
	}
	get control() {
		return this.form;
	}
	get path() {
		return [];
	}
	get controls() {
		return this.form.controls;
	}
	addControl(dir) {
		resolvedPromise$1.then(() => {
			dir.control = this._findContainer(dir.path).registerControl(dir.name, dir.control);
			dir._setupWithForm(this.callSetDisabledState);
			dir.control.updateValueAndValidity({ emitEvent: false });
			this._directives.add(dir);
		});
	}
	getControl(dir) {
		return this.form.get(dir.path);
	}
	removeControl(dir) {
		resolvedPromise$1.then(() => {
			this._findContainer(dir.path)?.removeControl(dir.name);
			this._directives.delete(dir);
		});
	}
	addFormGroup(dir) {
		resolvedPromise$1.then(() => {
			const container = this._findContainer(dir.path);
			const group = new FormGroup({});
			setUpFormContainer(group, dir);
			container.registerControl(dir.name, group);
			group.updateValueAndValidity({ emitEvent: false });
		});
	}
	removeFormGroup(dir) {
		resolvedPromise$1.then(() => {
			this._findContainer(dir.path)?.removeControl?.(dir.name);
		});
	}
	getFormGroup(dir) {
		return this.form.get(dir.path);
	}
	updateModel(dir, value) {
		resolvedPromise$1.then(() => {
			this.form.get(dir.path).setValue(value);
		});
	}
	setValue(value) {
		this.control.setValue(value);
	}
	onSubmit($event) {
		this.submittedReactive.set(true);
		syncPendingControls(this.form, this._directives);
		this.ngSubmit.emit($event);
		this.form._events.next(new FormSubmittedEvent(this.control));
		return $event?.target?.method === "dialog";
	}
	onReset() {
		this.resetForm();
	}
	resetForm(value = void 0) {
		this.form.reset(value);
		this.submittedReactive.set(false);
	}
	_setUpdateStrategy() {
		if (this.options && this.options.updateOn != null) this.form._updateOn = this.options.updateOn;
	}
	_findContainer(path) {
		path.pop();
		return path.length ? this.form.get(path) : this.form;
	}
	static ɵfac = function NgForm_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || NgForm)(ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10), ɵɵdirectiveInject(CALL_SET_DISABLED_STATE, 8));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: NgForm,
		selectors: [
			[
				"form",
				3,
				"ngNoForm",
				"",
				3,
				"formGroup",
				"",
				3,
				"formArray",
				""
			],
			["ng-form"],
			[
				"",
				"ngForm",
				""
			]
		],
		hostBindings: function NgForm_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("submit", function NgForm_submit_HostBindingHandler($event) {
				return ctx.onSubmit($event);
			})("reset", function NgForm_reset_HostBindingHandler() {
				return ctx.onReset();
			});
		},
		inputs: { options: [
			0,
			"ngFormOptions",
			"options"
		] },
		outputs: { ngSubmit: "ngSubmit" },
		exportAs: ["ngForm"],
		standalone: false,
		features: [ɵɵProvidersFeature([formDirectiveProvider$2]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgForm, [{
		type: Directive,
		args: [{
			selector: "form:not([ngNoForm]):not([formGroup]):not([formArray]),ng-form,[ngForm]",
			providers: [formDirectiveProvider$2],
			host: {
				"(submit)": "onSubmit($event)",
				"(reset)": "onReset()"
			},
			outputs: ["ngSubmit"],
			exportAs: "ngForm",
			standalone: false
		}]
	}], () => [
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [CALL_SET_DISABLED_STATE]
			}]
		}
	], { options: [{
		type: Input,
		args: ["ngFormOptions"]
	}] });
})();
function removeListItem(list, el) {
	const index = list.indexOf(el);
	if (index > -1) list.splice(index, 1);
}
function isFormControlState(formState) {
	return typeof formState === "object" && formState !== null && Object.keys(formState).length === 2 && "value" in formState && "disabled" in formState;
}
var FormControl = class FormControl extends AbstractControl {
	defaultValue = null;
	_onChange = [];
	_pendingValue;
	_pendingChange = false;
	constructor(formState = null, validatorOrOpts, asyncValidator) {
		super(pickValidators(validatorOrOpts), pickAsyncValidators(asyncValidator, validatorOrOpts));
		this._applyFormState(formState);
		this._setUpdateStrategy(validatorOrOpts);
		this._initObservables();
		this.updateValueAndValidity({
			onlySelf: true,
			emitEvent: !!this.asyncValidator
		});
		if (isOptionsObj(validatorOrOpts) && (validatorOrOpts.nonNullable || validatorOrOpts.initialValueIsDefault)) if (isFormControlState(formState)) this.defaultValue = formState.value;
		else this.defaultValue = formState;
	}
	setValue(value, options = {}) {
		untracked(() => {
			this.value = this._pendingValue = value;
			if (this._onChange.length && options.emitModelToViewChange !== false) this._onChange.forEach((changeFn) => changeFn(this.value, options.emitViewToModelChange !== false));
			this.updateValueAndValidity(options);
		});
	}
	patchValue(value, options = {}) {
		this.setValue(value, options);
	}
	reset(formState = this.defaultValue, options = {}) {
		this._applyFormState(formState);
		this.markAsPristine(options);
		this.markAsUntouched(options);
		this.setValue(this.value, options);
		if (options.overwriteDefaultValue) this.defaultValue = this.value;
		this._pendingChange = false;
		if (options?.emitEvent !== false) this._events.next(new FormResetEvent(this));
	}
	_updateValue() {}
	_anyControls(condition) {
		return false;
	}
	_allControlsDisabled() {
		return this.disabled;
	}
	registerOnChange(fn) {
		this._onChange.push(fn);
	}
	_unregisterOnChange(fn) {
		removeListItem(this._onChange, fn);
	}
	registerOnDisabledChange(fn) {
		this._onDisabledChange.push(fn);
	}
	_unregisterOnDisabledChange(fn) {
		removeListItem(this._onDisabledChange, fn);
	}
	_forEachChild(cb) {}
	_syncPendingControls() {
		if (this.updateOn === "submit") {
			if (this._pendingDirty) this.markAsDirty();
			if (this._pendingTouched) this.markAsTouched();
			if (this._pendingChange) {
				this.setValue(this._pendingValue, {
					onlySelf: true,
					emitModelToViewChange: false
				});
				return true;
			}
		}
		return false;
	}
	_applyFormState(formState) {
		if (isFormControlState(formState)) {
			this.value = this._pendingValue = formState.value;
			formState.disabled ? this.disable({
				onlySelf: true,
				emitEvent: false
			}) : this.enable({
				onlySelf: true,
				emitEvent: false
			});
		} else this.value = this._pendingValue = formState;
	}
};
var isFormControl = (control) => control instanceof FormControl;
var AbstractFormGroupDirective = class AbstractFormGroupDirective extends ControlContainer {
	_parent;
	ngOnInit() {
		this._checkParentType();
		this.formDirective.addFormGroup(this);
	}
	ngOnDestroy() {
		this.formDirective?.removeFormGroup(this);
	}
	get control() {
		return this.formDirective.getFormGroup(this);
	}
	get path() {
		return controlPath(this.name == null ? this.name : this.name.toString(), this._parent);
	}
	get formDirective() {
		return this._parent ? this._parent.formDirective : null;
	}
	_checkParentType() {}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵAbstractFormGroupDirective_BaseFactory;
		return function AbstractFormGroupDirective_Factory(__ngFactoryType__) {
			return (ɵAbstractFormGroupDirective_BaseFactory || (ɵAbstractFormGroupDirective_BaseFactory = ɵɵgetInheritedFactory(AbstractFormGroupDirective)))(__ngFactoryType__ || AbstractFormGroupDirective);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: AbstractFormGroupDirective,
		standalone: false,
		features: [ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AbstractFormGroupDirective, [{
		type: Directive,
		args: [{ standalone: false }]
	}], null, null);
})();
function modelParentException() {
	return new RuntimeError(1350, `
    ngModel cannot be used to register form controls with a parent formGroup directive.  Try using
    formGroup's partner directive "formControlName" instead.  Example:

    ${formControlNameExample}

    Or, if you'd like to avoid registering this form control, indicate that it's standalone in ngModelOptions:

    Example:

    ${ngModelWithFormGroupExample}`);
}
function formGroupNameException() {
	return new RuntimeError(1351, `
    ngModel cannot be used to register form controls with a parent formGroupName or formArrayName directive.

    Option 1: Use formControlName instead of ngModel (reactive strategy):

    ${formGroupNameExample}

    Option 2:  Update ngModel's parent be ngModelGroup (template-driven strategy):

    ${ngModelGroupExample}`);
}
function missingNameException() {
	return new RuntimeError(1352, `If ngModel is used within a form tag, either the name attribute must be set or the form
    control must be defined as 'standalone' in ngModelOptions.

    Example 1: <input [(ngModel)]="person.firstName" name="first">
    Example 2: <input [(ngModel)]="person.firstName" [ngModelOptions]="{standalone: true}">`);
}
function modelGroupParentException() {
	return new RuntimeError(1353, `
    ngModelGroup cannot be used with a parent formGroup directive.

    Option 1: Use formGroupName instead of ngModelGroup (reactive strategy):

    ${formGroupNameExample}

    Option 2:  Use a regular form tag instead of the formGroup directive (template-driven strategy):

    ${ngModelGroupExample}`);
}
var modelGroupProvider = {
	provide: ControlContainer,
	useExisting: forwardRef(() => NgModelGroup)
};
var NgModelGroup = class NgModelGroup extends AbstractFormGroupDirective {
	name = "";
	constructor(parent, validators, asyncValidators) {
		super();
		this._parent = parent;
		this._setValidators(validators);
		this._setAsyncValidators(asyncValidators);
	}
	_checkParentType() {
		if (!(this._parent instanceof NgModelGroup) && !(this._parent instanceof NgForm) && (typeof ngDevMode === "undefined" || ngDevMode)) throw modelGroupParentException();
	}
	static ɵfac = function NgModelGroup_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || NgModelGroup)(ɵɵdirectiveInject(ControlContainer, 5), ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: NgModelGroup,
		selectors: [[
			"",
			"ngModelGroup",
			""
		]],
		inputs: { name: [
			0,
			"ngModelGroup",
			"name"
		] },
		exportAs: ["ngModelGroup"],
		standalone: false,
		features: [ɵɵProvidersFeature([modelGroupProvider]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgModelGroup, [{
		type: Directive,
		args: [{
			selector: "[ngModelGroup]",
			providers: [modelGroupProvider],
			exportAs: "ngModelGroup",
			standalone: false
		}]
	}], () => [
		{
			type: ControlContainer,
			decorators: [{ type: Host }, { type: SkipSelf }]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		}
	], { name: [{
		type: Input,
		args: ["ngModelGroup"]
	}] });
})();
var formControlBinding$1 = {
	provide: NgControl,
	useExisting: forwardRef(() => NgModel)
};
var resolvedPromise = (() => Promise.resolve())();
var NgModel = class NgModel extends NgControl {
	_changeDetectorRef;
	callSetDisabledState;
	control = new FormControl();
	static ngAcceptInputType_isDisabled;
	_registered = false;
	viewModel;
	name = "";
	isDisabled;
	model;
	options;
	update = new EventEmitter();
	constructor(parent, validators, asyncValidators, valueAccessors, _changeDetectorRef, callSetDisabledState, injector, renderer) {
		super(injector, renderer, valueAccessors);
		this._changeDetectorRef = _changeDetectorRef;
		this.callSetDisabledState = callSetDisabledState;
		this._parent = parent;
		this._setValidators(validators);
		this._setAsyncValidators(asyncValidators);
	}
	ngOnChanges(changes) {
		this._checkForErrors();
		if (!this._registered || "name" in changes) {
			if (this._registered) {
				this._checkName();
				if (this.formDirective) {
					const oldName = changes["name"].previousValue;
					this.formDirective.removeControl({
						name: oldName,
						path: this._getPath(oldName)
					});
				}
			}
			this._setUpControl();
		}
		if ("isDisabled" in changes) this._updateDisabled(changes);
		if (isPropertyUpdated(changes, this.viewModel)) {
			this._updateValue(this.model);
			this.viewModel = this.model;
		}
	}
	ngOnDestroy() {
		this.formDirective?.removeControl(this);
	}
	ɵngControlCreate(host) {
		super.ngControlCreate(host);
	}
	ɵngControlUpdate(host) {
		super.ngControlUpdate(host, false);
	}
	get shouldBindRequired() {
		return false;
	}
	get path() {
		return this._getPath(this.name);
	}
	get formDirective() {
		return this._parent ? this._parent.formDirective : null;
	}
	viewToModelUpdate(newValue) {
		this.viewModel = newValue;
		this.update.emit(newValue);
	}
	_setUpControl() {
		this._setUpdateStrategy();
		this._isStandalone() ? this._setUpStandalone() : this.formDirective.addControl(this);
		this._registered = true;
	}
	_setUpdateStrategy() {
		if (this.options && this.options.updateOn != null) this.control._updateOn = this.options.updateOn;
	}
	_isStandalone() {
		return !this._parent || !!(this.options && this.options.standalone);
	}
	_setUpStandalone() {
		if (!this.isCustomControlBased) {
			this.valueAccessor ??= this.selectedValueAccessor;
			setUpControlValueAccessor(this.control, this, this.callSetDisabledState);
		} else this.setupCustomControl();
		this.control.updateValueAndValidity({ emitEvent: false });
	}
	_setupWithForm(callSetDisabledState) {
		if (!this.isCustomControlBased) {
			this.valueAccessor ??= this.selectedValueAccessor;
			setUpControlValueAccessor(this.control, this, callSetDisabledState);
		} else this.setupCustomControl();
	}
	_checkForErrors() {
		if ((typeof ngDevMode === "undefined" || ngDevMode) && !this._isStandalone()) checkParentType$1(this._parent);
		this._checkName();
	}
	_checkName() {
		if (this.options && this.options.name) this.name = this.options.name;
		if (!this._isStandalone() && !this.name && (typeof ngDevMode === "undefined" || ngDevMode)) throw missingNameException();
	}
	_updateValue(value) {
		resolvedPromise.then(() => {
			this.control.setValue(value, { emitViewToModelChange: false });
			this._changeDetectorRef?.markForCheck();
		});
	}
	_updateDisabled(changes) {
		const disabledValue = changes["isDisabled"].currentValue;
		const isDisabled = disabledValue !== 0 && booleanAttribute(disabledValue);
		resolvedPromise.then(() => {
			if (isDisabled && !this.control.disabled) this.control.disable();
			else if (!isDisabled && this.control.disabled) this.control.enable();
			this._changeDetectorRef?.markForCheck();
		});
	}
	_getPath(controlName) {
		return this._parent ? controlPath(controlName, this._parent) : [controlName];
	}
	static ɵfac = function NgModel_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || NgModel)(ɵɵdirectiveInject(ControlContainer, 9), ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10), ɵɵdirectiveInject(NG_VALUE_ACCESSOR, 10), ɵɵdirectiveInject(ChangeDetectorRef, 8), ɵɵdirectiveInject(CALL_SET_DISABLED_STATE, 8), ɵɵdirectiveInject(Injector, 8), ɵɵdirectiveInject(Renderer2, 8));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: NgModel,
		selectors: [[
			"",
			"ngModel",
			"",
			3,
			"formControlName",
			"",
			3,
			"formControl",
			""
		]],
		inputs: {
			name: "name",
			isDisabled: [
				0,
				"disabled",
				"isDisabled"
			],
			model: [
				0,
				"ngModel",
				"model"
			],
			options: [
				0,
				"ngModelOptions",
				"options"
			]
		},
		outputs: { update: "ngModelChange" },
		exportAs: ["ngModel"],
		standalone: false,
		features: [
			ɵɵProvidersFeature([formControlBinding$1, NG_CONTROL_INTEGRATION_PROVIDER]),
			ɵɵInheritDefinitionFeature,
			ɵɵNgOnChangesFeature,
			ɵɵControlFeature(null)
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgModel, [{
		type: Directive,
		args: [{
			selector: "[ngModel]:not([formControlName]):not([formControl])",
			providers: [formControlBinding$1, NG_CONTROL_INTEGRATION_PROVIDER],
			exportAs: "ngModel",
			standalone: false
		}]
	}], () => [
		{
			type: ControlContainer,
			decorators: [{ type: Optional }, { type: Host }]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALUE_ACCESSOR]
				}
			]
		},
		{
			type: ChangeDetectorRef,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [ChangeDetectorRef]
			}]
		},
		{
			type: void 0,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [CALL_SET_DISABLED_STATE]
			}]
		},
		{
			type: Injector,
			decorators: [{ type: Optional }]
		},
		{
			type: Renderer2,
			decorators: [{ type: Optional }]
		}
	], {
		name: [{ type: Input }],
		isDisabled: [{
			type: Input,
			args: ["disabled"]
		}],
		model: [{
			type: Input,
			args: ["ngModel"]
		}],
		options: [{
			type: Input,
			args: ["ngModelOptions"]
		}],
		update: [{
			type: Output,
			args: ["ngModelChange"]
		}]
	});
})();
function checkParentType$1(parent) {
	if (!(parent instanceof NgModelGroup) && parent instanceof AbstractFormGroupDirective) throw formGroupNameException();
	else if (!(parent instanceof NgModelGroup) && !(parent instanceof NgForm)) throw modelParentException();
}
var ɵNgNoValidate = class ɵNgNoValidate {
	static ɵfac = function ɵNgNoValidate_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || ɵNgNoValidate)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: ɵNgNoValidate,
		selectors: [[
			"form",
			3,
			"ngNoForm",
			"",
			3,
			"ngNativeValidate",
			""
		]],
		hostAttrs: ["novalidate", ""],
		standalone: false
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ɵNgNoValidate, [{
		type: Directive,
		args: [{
			selector: "form:not([ngNoForm]):not([ngNativeValidate])",
			host: { "novalidate": "" },
			standalone: false
		}]
	}], null, null);
})();
var NUMBER_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => NumberValueAccessor),
	multi: true
};
var NumberValueAccessor = class NumberValueAccessor extends BuiltInControlValueAccessor {
	writeValue(value) {
		const normalizedValue = value == null ? "" : value;
		this.setProperty("value", normalizedValue);
	}
	registerOnChange(fn) {
		this.onChange = (value) => {
			fn(value == "" ? null : parseFloat(value));
		};
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵNumberValueAccessor_BaseFactory;
		return function NumberValueAccessor_Factory(__ngFactoryType__) {
			return (ɵNumberValueAccessor_BaseFactory || (ɵNumberValueAccessor_BaseFactory = ɵɵgetInheritedFactory(NumberValueAccessor)))(__ngFactoryType__ || NumberValueAccessor);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: NumberValueAccessor,
		selectors: [
			[
				"input",
				"type",
				"number",
				"formControlName",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"number",
				"formControl",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"number",
				"ngModel",
				"",
				3,
				"ngNoCva",
				""
			]
		],
		hostBindings: function NumberValueAccessor_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("input", function NumberValueAccessor_input_HostBindingHandler($event) {
				return ctx.onChange($event.target.value);
			})("blur", function NumberValueAccessor_blur_HostBindingHandler() {
				return ctx.onTouched();
			});
		},
		standalone: false,
		features: [ɵɵProvidersFeature([NUMBER_VALUE_ACCESSOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NumberValueAccessor, [{
		type: Directive,
		args: [{
			selector: "input[type=number]:not([ngNoCva])[formControlName],input[type=number]:not([ngNoCva])[formControl],input[type=number]:not([ngNoCva])[ngModel]",
			host: {
				"(input)": "onChange($any($event.target).value)",
				"(blur)": "onTouched()"
			},
			providers: [NUMBER_VALUE_ACCESSOR],
			standalone: false
		}]
	}], null, null);
})();
var RADIO_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => RadioControlValueAccessor),
	multi: true
};
function throwNameError() {
	throw new RuntimeError(1202, `
      If you define both a name and a formControlName attribute on your radio button, their values
      must match. Ex: <input type="radio" formControlName="food" name="food">
    `);
}
var RadioControlRegistry = class RadioControlRegistry {
	_accessors = [];
	add(control, accessor) {
		this._accessors.push([control, accessor]);
	}
	remove(accessor) {
		for (let i = this._accessors.length - 1; i >= 0; --i) if (this._accessors[i][1] === accessor) {
			this._accessors.splice(i, 1);
			return;
		}
	}
	select(accessor) {
		this._accessors.forEach((c) => {
			if (this._isSameGroup(c, accessor) && c[1] !== accessor) c[1].fireUncheck(accessor.value);
		});
	}
	_isSameGroup(controlPair, accessor) {
		if (!controlPair[0].control) return false;
		return controlPair[0]._parent === accessor._control._parent && controlPair[1].name === accessor.name;
	}
	static ɵfac = function RadioControlRegistry_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || RadioControlRegistry)();
	};
	static ɵprov = /* @__PURE__ */ ɵɵdefineService({
		token: RadioControlRegistry,
		factory: RadioControlRegistry.ɵfac
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(RadioControlRegistry, [{ type: Service }], null, null);
})();
var RadioControlValueAccessor = class RadioControlValueAccessor extends BuiltInControlValueAccessor {
	_registry;
	_injector;
	_state;
	_control;
	_fn;
	setDisabledStateFired = false;
	onChange = () => {};
	name;
	formControlName;
	value;
	callSetDisabledState = inject(CALL_SET_DISABLED_STATE, { optional: true }) ?? setDisabledStateDefault;
	constructor(renderer, elementRef, _registry, _injector) {
		super(renderer, elementRef);
		this._registry = _registry;
		this._injector = _injector;
	}
	ngOnChanges(changes) {
		const control = this._control?.control;
		if (changes["value"] && control) this.writeValue(control.value);
	}
	ngOnInit() {
		this._control = this._injector.get(NgControl);
		this._checkName();
		this._registry.add(this._control, this);
	}
	ngOnDestroy() {
		this._registry.remove(this);
	}
	writeValue(value) {
		this._state = value === this.value;
		this.setProperty("checked", this._state);
	}
	registerOnChange(fn) {
		this._fn = fn;
		this.onChange = () => {
			fn(this.value);
			this._registry.select(this);
		};
	}
	setDisabledState(isDisabled) {
		if (this.setDisabledStateFired || isDisabled || this.callSetDisabledState === "whenDisabledForLegacyCode") this.setProperty("disabled", isDisabled);
		this.setDisabledStateFired = true;
	}
	fireUncheck(value) {
		this.writeValue(value);
	}
	_checkName() {
		if (this.name && this.formControlName && this.name !== this.formControlName && (typeof ngDevMode === "undefined" || ngDevMode)) throwNameError();
		if (!this.name && this.formControlName) this.name = this.formControlName;
	}
	static ɵfac = function RadioControlValueAccessor_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || RadioControlValueAccessor)(ɵɵdirectiveInject(Renderer2), ɵɵdirectiveInject(ElementRef), ɵɵdirectiveInject(RadioControlRegistry), ɵɵdirectiveInject(Injector));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: RadioControlValueAccessor,
		selectors: [
			[
				"input",
				"type",
				"radio",
				"formControlName",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"radio",
				"formControl",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"radio",
				"ngModel",
				"",
				3,
				"ngNoCva",
				""
			]
		],
		hostBindings: function RadioControlValueAccessor_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("change", function RadioControlValueAccessor_change_HostBindingHandler() {
				return ctx.onChange();
			})("blur", function RadioControlValueAccessor_blur_HostBindingHandler() {
				return ctx.onTouched();
			});
		},
		inputs: {
			name: "name",
			formControlName: "formControlName",
			value: "value"
		},
		standalone: false,
		features: [
			ɵɵProvidersFeature([RADIO_VALUE_ACCESSOR]),
			ɵɵInheritDefinitionFeature,
			ɵɵNgOnChangesFeature
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(RadioControlValueAccessor, [{
		type: Directive,
		args: [{
			selector: "input[type=radio]:not([ngNoCva])[formControlName],input[type=radio]:not([ngNoCva])[formControl],input[type=radio]:not([ngNoCva])[ngModel]",
			host: {
				"(change)": "onChange()",
				"(blur)": "onTouched()"
			},
			providers: [RADIO_VALUE_ACCESSOR],
			standalone: false
		}]
	}], () => [
		{ type: Renderer2 },
		{ type: ElementRef },
		{ type: RadioControlRegistry },
		{ type: Injector }
	], {
		name: [{ type: Input }],
		formControlName: [{ type: Input }],
		value: [{ type: Input }]
	});
})();
var RANGE_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => RangeValueAccessor),
	multi: true
};
var RangeValueAccessor = class RangeValueAccessor extends BuiltInControlValueAccessor {
	writeValue(value) {
		this.setProperty("value", parseFloat(value));
	}
	registerOnChange(fn) {
		this.onChange = (value) => {
			fn(value == "" ? null : parseFloat(value));
		};
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵRangeValueAccessor_BaseFactory;
		return function RangeValueAccessor_Factory(__ngFactoryType__) {
			return (ɵRangeValueAccessor_BaseFactory || (ɵRangeValueAccessor_BaseFactory = ɵɵgetInheritedFactory(RangeValueAccessor)))(__ngFactoryType__ || RangeValueAccessor);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: RangeValueAccessor,
		selectors: [
			[
				"input",
				"type",
				"range",
				"formControlName",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"range",
				"formControl",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"input",
				"type",
				"range",
				"ngModel",
				"",
				3,
				"ngNoCva",
				""
			]
		],
		hostBindings: function RangeValueAccessor_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("change", function RangeValueAccessor_change_HostBindingHandler($event) {
				return ctx.onChange($event.target.value);
			})("input", function RangeValueAccessor_input_HostBindingHandler($event) {
				return ctx.onChange($event.target.value);
			})("blur", function RangeValueAccessor_blur_HostBindingHandler() {
				return ctx.onTouched();
			});
		},
		standalone: false,
		features: [ɵɵProvidersFeature([RANGE_VALUE_ACCESSOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(RangeValueAccessor, [{
		type: Directive,
		args: [{
			selector: "input[type=range]:not([ngNoCva])[formControlName],input[type=range]:not([ngNoCva])[formControl],input[type=range]:not([ngNoCva])[ngModel]",
			host: {
				"(change)": "onChange($any($event.target).value)",
				"(input)": "onChange($any($event.target).value)",
				"(blur)": "onTouched()"
			},
			providers: [RANGE_VALUE_ACCESSOR],
			standalone: false
		}]
	}], null, null);
})();
var FormArray = class extends AbstractControl {
	constructor(controls, validatorOrOpts, asyncValidator) {
		super(pickValidators(validatorOrOpts), pickAsyncValidators(asyncValidator, validatorOrOpts));
		this.controls = controls;
		this._initObservables();
		this._setUpdateStrategy(validatorOrOpts);
		this._setUpControls();
		this.updateValueAndValidity({
			onlySelf: true,
			emitEvent: !!this.asyncValidator
		});
	}
	controls;
	at(index) {
		return this.controls[this._adjustIndex(index)];
	}
	push(control, options = {}) {
		if (Array.isArray(control)) control.forEach((ctrl) => {
			this.controls.push(ctrl);
			this._registerControl(ctrl);
		});
		else {
			this.controls.push(control);
			this._registerControl(control);
		}
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
		this._onCollectionChange();
	}
	insert(index, control, options = {}) {
		this.controls.splice(index, 0, control);
		this._registerControl(control);
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
	}
	removeAt(index, options = {}) {
		let adjustedIndex = this._adjustIndex(index);
		if (adjustedIndex < 0) adjustedIndex = 0;
		if (this.controls[adjustedIndex]) this.controls[adjustedIndex]._registerOnCollectionChange(() => {});
		this.controls.splice(adjustedIndex, 1);
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
	}
	setControl(index, control, options = {}) {
		let adjustedIndex = this._adjustIndex(index);
		if (adjustedIndex < 0) adjustedIndex = 0;
		if (this.controls[adjustedIndex]) this.controls[adjustedIndex]._registerOnCollectionChange(() => {});
		this.controls.splice(adjustedIndex, 1);
		if (control) {
			this.controls.splice(adjustedIndex, 0, control);
			this._registerControl(control);
		}
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
		this._onCollectionChange();
	}
	get length() {
		return this.controls.length;
	}
	setValue(value, options = {}) {
		untracked(() => {
			assertAllValuesPresent(this, false, value);
			value.forEach((newValue, index) => {
				assertControlPresent(this, false, index);
				this.at(index).setValue(newValue, {
					onlySelf: true,
					emitEvent: options.emitEvent
				});
			});
			this.updateValueAndValidity(options);
		});
	}
	patchValue(value, options = {}) {
		if (value == null) return;
		value.forEach((newValue, index) => {
			if (this.at(index)) this.at(index).patchValue(newValue, {
				onlySelf: true,
				emitEvent: options.emitEvent
			});
		});
		this.updateValueAndValidity(options);
	}
	reset(value = [], options = {}) {
		this._forEachChild((control, index) => {
			control.reset(value[index], {
				...options,
				onlySelf: true
			});
		});
		this._updatePristine(options, this);
		this._updateTouched(options, this);
		this.updateValueAndValidity(options);
		if (options?.emitEvent !== false) this._events.next(new FormResetEvent(this));
	}
	getRawValue() {
		return this.controls.map((control) => control.getRawValue());
	}
	clear(options = {}) {
		if (this.controls.length < 1) return;
		this._forEachChild((control) => control._registerOnCollectionChange(() => {}));
		this.controls.splice(0);
		this.updateValueAndValidity({ emitEvent: options.emitEvent });
	}
	_adjustIndex(index) {
		return index < 0 ? index + this.length : index;
	}
	_syncPendingControls() {
		let subtreeUpdated = this.controls.reduce((updated, child) => {
			return child._syncPendingControls() ? true : updated;
		}, false);
		if (subtreeUpdated) this.updateValueAndValidity({ onlySelf: true });
		return subtreeUpdated;
	}
	_forEachChild(cb) {
		this.controls.forEach((control, index) => {
			cb(control, index);
		});
	}
	_updateValue() {
		this.value = this.controls.filter((control) => control.enabled || this.disabled).map((control) => control.value);
	}
	_anyControls(condition) {
		return this.controls.some((control) => control.enabled && condition(control));
	}
	_setUpControls() {
		this._forEachChild((control) => this._registerControl(control));
	}
	_allControlsDisabled() {
		for (const control of this.controls) if (control.enabled) return false;
		return this.controls.length > 0 || this.disabled;
	}
	_registerControl(control) {
		control.setParent(this);
		control._registerOnCollectionChange(this._onCollectionChange);
	}
	_find(name) {
		return this.at(name) ?? null;
	}
};
var AbstractFormDirective = class AbstractFormDirective extends ControlContainer {
	callSetDisabledState;
	get submitted() {
		return untracked(this._submittedReactive);
	}
	set submitted(value) {
		this._submittedReactive.set(value);
	}
	_submitted = computed(() => this._submittedReactive(), ...ngDevMode ? [{ debugName: "_submitted" }] : []);
	_submittedReactive = signal(false, ...ngDevMode ? [{ debugName: "_submittedReactive" }] : []);
	_oldForm;
	_onCollectionChange = () => this._updateDomValue();
	directives = [];
	constructor(validators, asyncValidators, callSetDisabledState) {
		super();
		this.callSetDisabledState = callSetDisabledState;
		this._setValidators(validators);
		this._setAsyncValidators(asyncValidators);
	}
	ngOnChanges(changes) {
		this.onChanges(changes);
	}
	ngOnDestroy() {
		this.onDestroy();
	}
	onChanges(changes) {
		this._checkFormPresent();
		if (changes.hasOwnProperty("form")) {
			this._updateValidators();
			this._updateDomValue();
			this._updateRegistrations();
			this._oldForm = this.form;
		}
	}
	onDestroy() {
		if (this.form) {
			cleanUpValidators(this.form, this);
			if (this.form._onCollectionChange === this._onCollectionChange) this.form._registerOnCollectionChange(() => {});
		}
	}
	get formDirective() {
		return this;
	}
	get path() {
		return [];
	}
	addControl(dir) {
		const ctrl = this.form.get(dir.path);
		dir._setupWithForm(ctrl, this.callSetDisabledState);
		ctrl.updateValueAndValidity({ emitEvent: false });
		this.directives.push(dir);
		return ctrl;
	}
	getControl(dir) {
		return this.form.get(dir.path);
	}
	removeControl(dir) {
		cleanUpControl(dir.control || null, dir, false);
		removeListItem$1(this.directives, dir);
	}
	addFormGroup(dir) {
		this._setUpFormContainer(dir);
	}
	removeFormGroup(dir) {
		this._cleanUpFormContainer(dir);
	}
	getFormGroup(dir) {
		return this.form.get(dir.path);
	}
	getFormArray(dir) {
		return this.form.get(dir.path);
	}
	addFormArray(dir) {
		this._setUpFormContainer(dir);
	}
	removeFormArray(dir) {
		this._cleanUpFormContainer(dir);
	}
	updateModel(dir, value) {
		this.form.get(dir.path).setValue(value);
	}
	onReset() {
		this.resetForm();
	}
	resetForm(value = void 0, options = {}) {
		this.form.reset(value, options);
		this._submittedReactive.set(false);
	}
	onSubmit($event) {
		this.submitted = true;
		syncPendingControls(this.form, this.directives);
		this.ngSubmit.emit($event);
		this.form._events.next(new FormSubmittedEvent(this.control));
		return $event?.target?.method === "dialog";
	}
	_updateDomValue() {
		this.directives.forEach((dir) => {
			const oldCtrl = dir.control;
			const newCtrl = this.form.get(dir.path);
			if (oldCtrl !== newCtrl) {
				cleanUpControl(oldCtrl || null, dir);
				if (isFormControl(newCtrl)) dir._setupWithForm(newCtrl, this.callSetDisabledState);
			}
		});
		this.form._updateTreeValidity({ emitEvent: false });
	}
	_setUpFormContainer(dir) {
		const ctrl = this.form.get(dir.path);
		setUpFormContainer(ctrl, dir);
		ctrl.updateValueAndValidity({ emitEvent: false });
	}
	_cleanUpFormContainer(dir) {
		const ctrl = this.form?.get(dir.path);
		if (ctrl) {
			if (cleanUpFormContainer(ctrl, dir)) ctrl.updateValueAndValidity({ emitEvent: false });
		}
	}
	_updateRegistrations() {
		this.form._registerOnCollectionChange(this._onCollectionChange);
		this._oldForm?._registerOnCollectionChange(() => {});
	}
	_updateValidators() {
		setUpValidators(this.form, this);
		if (this._oldForm) cleanUpValidators(this._oldForm, this);
	}
	_checkFormPresent() {
		if (!this.form && (typeof ngDevMode === "undefined" || ngDevMode)) throw missingFormException();
	}
	static ɵfac = function AbstractFormDirective_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || AbstractFormDirective)(ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10), ɵɵdirectiveInject(CALL_SET_DISABLED_STATE, 8));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: AbstractFormDirective,
		features: [ɵɵInheritDefinitionFeature, ɵɵNgOnChangesFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AbstractFormDirective, [{ type: Directive }], () => [
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [CALL_SET_DISABLED_STATE]
			}]
		}
	], null);
})();
var formDirectiveProvider$1 = {
	provide: ControlContainer,
	useExisting: forwardRef(() => FormArrayDirective)
};
var FormArrayDirective = class FormArrayDirective extends AbstractFormDirective {
	form = null;
	ngSubmit = new EventEmitter();
	get control() {
		return this.form;
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵFormArrayDirective_BaseFactory;
		return function FormArrayDirective_Factory(__ngFactoryType__) {
			return (ɵFormArrayDirective_BaseFactory || (ɵFormArrayDirective_BaseFactory = ɵɵgetInheritedFactory(FormArrayDirective)))(__ngFactoryType__ || FormArrayDirective);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: FormArrayDirective,
		selectors: [[
			"",
			"formArray",
			""
		]],
		hostBindings: function FormArrayDirective_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("submit", function FormArrayDirective_submit_HostBindingHandler($event) {
				return ctx.onSubmit($event);
			})("reset", function FormArrayDirective_reset_HostBindingHandler() {
				return ctx.onReset();
			});
		},
		inputs: { form: [
			0,
			"formArray",
			"form"
		] },
		outputs: { ngSubmit: "ngSubmit" },
		exportAs: ["ngForm"],
		standalone: false,
		features: [ɵɵProvidersFeature([formDirectiveProvider$1]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormArrayDirective, [{
		type: Directive,
		args: [{
			selector: "[formArray]",
			providers: [formDirectiveProvider$1],
			host: {
				"(submit)": "onSubmit($event)",
				"(reset)": "onReset()"
			},
			exportAs: "ngForm",
			standalone: false
		}]
	}], null, {
		form: [{
			type: Input,
			args: ["formArray"]
		}],
		ngSubmit: [{ type: Output }]
	});
})();
var NG_MODEL_WITH_FORM_CONTROL_WARNING = new InjectionToken(typeof ngDevMode !== "undefined" && ngDevMode ? "NgModelWithFormControlWarning" : "");
var formControlBinding = {
	provide: NgControl,
	useExisting: forwardRef(() => FormControlDirective)
};
var FormControlDirective = class FormControlDirective extends NgControl {
	_ngModelWarningConfig;
	callSetDisabledState;
	viewModel;
	form;
	set isDisabled(isDisabled) {
		if (typeof ngDevMode === "undefined" || ngDevMode) console.warn(disabledAttrWarning);
	}
	model;
	update = new EventEmitter();
	static _ngModelWarningSentOnce = false;
	_ngModelWarningSent = false;
	constructor(validators, asyncValidators, valueAccessors, _ngModelWarningConfig, callSetDisabledState, renderer, injector) {
		super(injector, renderer, valueAccessors);
		this._ngModelWarningConfig = _ngModelWarningConfig;
		this.callSetDisabledState = callSetDisabledState;
		this._setValidators(validators);
		this._setAsyncValidators(asyncValidators);
	}
	ngOnChanges(changes) {
		if (this._isControlChanged(changes)) {
			const previousForm = changes["form"].previousValue;
			if (previousForm) {
				cleanUpControl(previousForm, this, false);
				this.removeParseErrorsValidator(previousForm);
			}
			if (!this.isCustomControlBased) {
				this.valueAccessor ??= this.selectedValueAccessor;
				setUpControlValueAccessor(this.form, this, this.callSetDisabledState);
			} else this.setupCustomControl();
			this.form.updateValueAndValidity({ emitEvent: false });
		}
		if (isPropertyUpdated(changes, this.viewModel)) {
			if (typeof ngDevMode === "undefined" || ngDevMode) _ngModelWarning("formControl", FormControlDirective, this, this._ngModelWarningConfig);
			this.form.setValue(this.model);
			this.viewModel = this.model;
		}
	}
	ngOnDestroy() {
		if (this.form) cleanUpControl(this.form, this, false);
	}
	get path() {
		return [];
	}
	get control() {
		return this.form;
	}
	viewToModelUpdate(newValue) {
		this.viewModel = newValue;
		this.update.emit(newValue);
	}
	_isControlChanged(changes) {
		return changes.hasOwnProperty("form");
	}
	ɵngControlCreate(host) {
		super.ngControlCreate(host);
	}
	ɵngControlUpdate(host) {
		super.ngControlUpdate(host, true);
	}
	static ɵfac = function FormControlDirective_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || FormControlDirective)(ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10), ɵɵdirectiveInject(NG_VALUE_ACCESSOR, 10), ɵɵdirectiveInject(NG_MODEL_WITH_FORM_CONTROL_WARNING, 8), ɵɵdirectiveInject(CALL_SET_DISABLED_STATE, 8), ɵɵdirectiveInject(Renderer2, 8), ɵɵdirectiveInject(Injector, 8));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: FormControlDirective,
		selectors: [[
			"",
			"formControl",
			""
		]],
		inputs: {
			form: [
				0,
				"formControl",
				"form"
			],
			isDisabled: [
				0,
				"disabled",
				"isDisabled"
			],
			model: [
				0,
				"ngModel",
				"model"
			]
		},
		outputs: { update: "ngModelChange" },
		exportAs: ["ngForm"],
		standalone: false,
		features: [
			ɵɵProvidersFeature([formControlBinding, NG_CONTROL_INTEGRATION_PROVIDER]),
			ɵɵInheritDefinitionFeature,
			ɵɵNgOnChangesFeature,
			ɵɵControlFeature(null)
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormControlDirective, [{
		type: Directive,
		args: [{
			selector: "[formControl]",
			providers: [formControlBinding, NG_CONTROL_INTEGRATION_PROVIDER],
			exportAs: "ngForm",
			standalone: false
		}]
	}], () => [
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALUE_ACCESSOR]
				}
			]
		},
		{
			type: void 0,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [NG_MODEL_WITH_FORM_CONTROL_WARNING]
			}]
		},
		{
			type: void 0,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [CALL_SET_DISABLED_STATE]
			}]
		},
		{
			type: Renderer2,
			decorators: [{ type: Optional }]
		},
		{
			type: Injector,
			decorators: [{ type: Optional }]
		}
	], {
		form: [{
			type: Input,
			args: ["formControl"]
		}],
		isDisabled: [{
			type: Input,
			args: ["disabled"]
		}],
		model: [{
			type: Input,
			args: ["ngModel"]
		}],
		update: [{
			type: Output,
			args: ["ngModelChange"]
		}]
	});
})();
var formGroupNameProvider = {
	provide: ControlContainer,
	useExisting: forwardRef(() => FormGroupName)
};
var FormGroupName = class FormGroupName extends AbstractFormGroupDirective {
	name = null;
	constructor(parent, validators, asyncValidators) {
		super();
		this._parent = parent;
		this._setValidators(validators);
		this._setAsyncValidators(asyncValidators);
	}
	_checkParentType() {
		if (hasInvalidParent(this._parent) && (typeof ngDevMode === "undefined" || ngDevMode)) throw groupParentException();
	}
	static ɵfac = function FormGroupName_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || FormGroupName)(ɵɵdirectiveInject(ControlContainer, 13), ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: FormGroupName,
		selectors: [[
			"",
			"formGroupName",
			""
		]],
		inputs: { name: [
			0,
			"formGroupName",
			"name"
		] },
		standalone: false,
		features: [ɵɵProvidersFeature([formGroupNameProvider]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormGroupName, [{
		type: Directive,
		args: [{
			selector: "[formGroupName]",
			providers: [formGroupNameProvider],
			standalone: false
		}]
	}], () => [
		{
			type: ControlContainer,
			decorators: [
				{ type: Optional },
				{ type: Host },
				{ type: SkipSelf }
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		}
	], { name: [{
		type: Input,
		args: ["formGroupName"]
	}] });
})();
var formArrayNameProvider = {
	provide: ControlContainer,
	useExisting: forwardRef(() => FormArrayName)
};
var FormArrayName = class FormArrayName extends ControlContainer {
	_parent;
	name = null;
	constructor(parent, validators, asyncValidators) {
		super();
		this._parent = parent;
		this._setValidators(validators);
		this._setAsyncValidators(asyncValidators);
	}
	ngOnInit() {
		if (hasInvalidParent(this._parent) && (typeof ngDevMode === "undefined" || ngDevMode)) throw arrayParentException();
		this.formDirective.addFormArray(this);
	}
	ngOnDestroy() {
		this.formDirective?.removeFormArray(this);
	}
	get control() {
		return this.formDirective.getFormArray(this);
	}
	get formDirective() {
		return this._parent ? this._parent.formDirective : null;
	}
	get path() {
		return controlPath(this.name == null ? this.name : this.name.toString(), this._parent);
	}
	static ɵfac = function FormArrayName_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || FormArrayName)(ɵɵdirectiveInject(ControlContainer, 13), ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: FormArrayName,
		selectors: [[
			"",
			"formArrayName",
			""
		]],
		inputs: { name: [
			0,
			"formArrayName",
			"name"
		] },
		standalone: false,
		features: [ɵɵProvidersFeature([formArrayNameProvider]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormArrayName, [{
		type: Directive,
		args: [{
			selector: "[formArrayName]",
			providers: [formArrayNameProvider],
			standalone: false
		}]
	}], () => [
		{
			type: ControlContainer,
			decorators: [
				{ type: Optional },
				{ type: Host },
				{ type: SkipSelf }
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		}
	], { name: [{
		type: Input,
		args: ["formArrayName"]
	}] });
})();
function hasInvalidParent(parent) {
	return !(parent instanceof FormGroupName) && !(parent instanceof AbstractFormDirective) && !(parent instanceof FormArrayName);
}
var controlNameBinding = {
	provide: NgControl,
	useExisting: forwardRef(() => FormControlName)
};
var FormControlName = class FormControlName extends NgControl {
	_ngModelWarningConfig;
	_added = false;
	viewModel;
	control;
	name = null;
	set isDisabled(isDisabled) {
		if (typeof ngDevMode === "undefined" || ngDevMode) console.warn(disabledAttrWarning);
	}
	model;
	update = new EventEmitter();
	static _ngModelWarningSentOnce = false;
	_ngModelWarningSent = false;
	constructor(parent, validators, asyncValidators, valueAccessors, _ngModelWarningConfig, renderer, injector) {
		super(injector, renderer, valueAccessors);
		this._ngModelWarningConfig = _ngModelWarningConfig;
		this._parent = parent;
		this._setValidators(validators);
		this._setAsyncValidators(asyncValidators);
	}
	_setupWithForm(control, callSetDisabledState) {
		this.control = control;
		if (!this.isCustomControlBased) {
			this.valueAccessor ??= this.selectedValueAccessor;
			setUpControlValueAccessor(control, this, callSetDisabledState);
		} else this.setupCustomControl();
	}
	ngOnChanges(changes) {
		if (!this._added) this._setUpControl();
		if (isPropertyUpdated(changes, this.viewModel)) {
			if (typeof ngDevMode === "undefined" || ngDevMode) _ngModelWarning("formControlName", FormControlName, this, this._ngModelWarningConfig);
			this.viewModel = this.model;
			this.formDirective.updateModel(this, this.model);
		}
	}
	ngOnDestroy() {
		this.formDirective?.removeControl(this);
	}
	viewToModelUpdate(newValue) {
		this.viewModel = newValue;
		this.update.emit(newValue);
	}
	get path() {
		return controlPath(this.name == null ? this.name : this.name.toString(), this._parent);
	}
	get formDirective() {
		return this._parent ? this._parent.formDirective : null;
	}
	_setUpControl() {
		if (typeof ngDevMode === "undefined" || ngDevMode) checkParentType(this._parent, this.name);
		this.control = this.formDirective.addControl(this);
		this._added = true;
	}
	ɵngControlCreate(host) {
		super.ngControlCreate(host);
	}
	ɵngControlUpdate(host) {
		if (!this.isCustomControlBased) return;
		if (!this._added) this._setUpControl();
		super.ngControlUpdate(host, true);
	}
	static ɵfac = function FormControlName_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || FormControlName)(ɵɵdirectiveInject(ControlContainer, 13), ɵɵdirectiveInject(NG_VALIDATORS, 10), ɵɵdirectiveInject(NG_ASYNC_VALIDATORS, 10), ɵɵdirectiveInject(NG_VALUE_ACCESSOR, 10), ɵɵdirectiveInject(NG_MODEL_WITH_FORM_CONTROL_WARNING, 8), ɵɵdirectiveInject(Renderer2, 8), ɵɵdirectiveInject(Injector, 8));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: FormControlName,
		selectors: [[
			"",
			"formControlName",
			""
		]],
		inputs: {
			name: [
				0,
				"formControlName",
				"name"
			],
			isDisabled: [
				0,
				"disabled",
				"isDisabled"
			],
			model: [
				0,
				"ngModel",
				"model"
			]
		},
		outputs: { update: "ngModelChange" },
		standalone: false,
		features: [
			ɵɵProvidersFeature([controlNameBinding, NG_CONTROL_INTEGRATION_PROVIDER]),
			ɵɵInheritDefinitionFeature,
			ɵɵNgOnChangesFeature,
			ɵɵControlFeature(null)
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormControlName, [{
		type: Directive,
		args: [{
			selector: "[formControlName]",
			providers: [controlNameBinding, NG_CONTROL_INTEGRATION_PROVIDER],
			standalone: false
		}]
	}], () => [
		{
			type: ControlContainer,
			decorators: [
				{ type: Optional },
				{ type: Host },
				{ type: SkipSelf }
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_ASYNC_VALIDATORS]
				}
			]
		},
		{
			type: void 0,
			decorators: [
				{ type: Optional },
				{ type: Self },
				{
					type: Inject,
					args: [NG_VALUE_ACCESSOR]
				}
			]
		},
		{
			type: void 0,
			decorators: [{ type: Optional }, {
				type: Inject,
				args: [NG_MODEL_WITH_FORM_CONTROL_WARNING]
			}]
		},
		{
			type: Renderer2,
			decorators: [{ type: Optional }]
		},
		{
			type: Injector,
			decorators: [{ type: Optional }]
		}
	], {
		name: [{
			type: Input,
			args: ["formControlName"]
		}],
		isDisabled: [{
			type: Input,
			args: ["disabled"]
		}],
		model: [{
			type: Input,
			args: ["ngModel"]
		}],
		update: [{
			type: Output,
			args: ["ngModelChange"]
		}]
	});
})();
function checkParentType(parent, name) {
	if (!(parent instanceof FormGroupName) && parent instanceof AbstractFormGroupDirective) throw ngModelGroupException();
	else if (!(parent instanceof FormGroupName) && !(parent instanceof AbstractFormDirective) && !(parent instanceof FormArrayName)) throw controlParentException(name);
}
var formDirectiveProvider = {
	provide: ControlContainer,
	useExisting: forwardRef(() => FormGroupDirective)
};
var FormGroupDirective = class FormGroupDirective extends AbstractFormDirective {
	form = null;
	ngSubmit = new EventEmitter();
	get control() {
		return this.form;
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵFormGroupDirective_BaseFactory;
		return function FormGroupDirective_Factory(__ngFactoryType__) {
			return (ɵFormGroupDirective_BaseFactory || (ɵFormGroupDirective_BaseFactory = ɵɵgetInheritedFactory(FormGroupDirective)))(__ngFactoryType__ || FormGroupDirective);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: FormGroupDirective,
		selectors: [[
			"",
			"formGroup",
			""
		]],
		hostBindings: function FormGroupDirective_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("submit", function FormGroupDirective_submit_HostBindingHandler($event) {
				return ctx.onSubmit($event);
			})("reset", function FormGroupDirective_reset_HostBindingHandler() {
				return ctx.onReset();
			});
		},
		inputs: { form: [
			0,
			"formGroup",
			"form"
		] },
		outputs: { ngSubmit: "ngSubmit" },
		exportAs: ["ngForm"],
		standalone: false,
		features: [ɵɵProvidersFeature([formDirectiveProvider]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormGroupDirective, [{
		type: Directive,
		args: [{
			selector: "[formGroup]",
			providers: [formDirectiveProvider],
			host: {
				"(submit)": "onSubmit($event)",
				"(reset)": "onReset()"
			},
			exportAs: "ngForm",
			standalone: false
		}]
	}], null, {
		form: [{
			type: Input,
			args: ["formGroup"]
		}],
		ngSubmit: [{ type: Output }]
	});
})();
var SELECT_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => SelectControlValueAccessor),
	multi: true
};
function _buildValueString$1(id, value) {
	if (id == null) return `${value}`;
	if (value && typeof value === "object") value = "Object";
	return `${id}: ${value}`.slice(0, 50);
}
function _extractId$1(valueString) {
	return valueString.split(":")[0];
}
var SelectControlValueAccessor = class SelectControlValueAccessor extends BuiltInControlValueAccessor {
	value;
	_optionMap = /* @__PURE__ */ new Map();
	_idCounter = 0;
	set compareWith(fn) {
		if (typeof fn !== "function" && (typeof ngDevMode === "undefined" || ngDevMode)) throw new RuntimeError(1201, `compareWith must be a function, but received ${JSON.stringify(fn)}`);
		this._compareWith = fn;
	}
	_compareWith = Object.is;
	appRefInjector = inject(ApplicationRef).injector;
	destroyRef = inject(DestroyRef);
	cdr = inject(ChangeDetectorRef);
	_queuedWrite = false;
	_writeValueAfterRender() {
		if (this._queuedWrite || this.appRefInjector.destroyed) return;
		this._queuedWrite = true;
		afterNextRender({ write: () => {
			if (this.destroyRef.destroyed) return;
			this._queuedWrite = false;
			this.writeValue(this.value);
		} }, { injector: this.appRefInjector });
	}
	writeValue(value) {
		this.cdr.markForCheck();
		this.value = value;
		const valueString = _buildValueString$1(this._getOptionId(value), value);
		this.setProperty("value", valueString);
	}
	registerOnChange(fn) {
		this.onChange = (valueString) => {
			this.value = this._getOptionValue(valueString);
			fn(this.value);
		};
	}
	_registerOption() {
		return (this._idCounter++).toString();
	}
	_getOptionId(value) {
		for (const id of this._optionMap.keys()) if (this._compareWith(this._optionMap.get(id), value)) return id;
		return null;
	}
	_getOptionValue(valueString) {
		const id = _extractId$1(valueString);
		return this._optionMap.has(id) ? this._optionMap.get(id) : valueString;
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵSelectControlValueAccessor_BaseFactory;
		return function SelectControlValueAccessor_Factory(__ngFactoryType__) {
			return (ɵSelectControlValueAccessor_BaseFactory || (ɵSelectControlValueAccessor_BaseFactory = ɵɵgetInheritedFactory(SelectControlValueAccessor)))(__ngFactoryType__ || SelectControlValueAccessor);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: SelectControlValueAccessor,
		selectors: [
			[
				"select",
				"formControlName",
				"",
				3,
				"multiple",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"select",
				"formControl",
				"",
				3,
				"multiple",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"select",
				"ngModel",
				"",
				3,
				"multiple",
				"",
				3,
				"ngNoCva",
				""
			]
		],
		hostBindings: function SelectControlValueAccessor_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("change", function SelectControlValueAccessor_change_HostBindingHandler($event) {
				return ctx.onChange($event.target.value);
			})("blur", function SelectControlValueAccessor_blur_HostBindingHandler() {
				return ctx.onTouched();
			});
		},
		inputs: { compareWith: "compareWith" },
		standalone: false,
		features: [ɵɵProvidersFeature([SELECT_VALUE_ACCESSOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SelectControlValueAccessor, [{
		type: Directive,
		args: [{
			selector: "select:not([multiple]):not([ngNoCva])[formControlName],select:not([multiple]):not([ngNoCva])[formControl],select:not([multiple]):not([ngNoCva])[ngModel]",
			host: {
				"(change)": "onChange($any($event.target).value)",
				"(blur)": "onTouched()"
			},
			providers: [SELECT_VALUE_ACCESSOR],
			standalone: false
		}]
	}], null, { compareWith: [{ type: Input }] });
})();
var NgSelectOption = class NgSelectOption {
	_element;
	_renderer;
	_select;
	id;
	constructor(_element, _renderer, _select) {
		this._element = _element;
		this._renderer = _renderer;
		this._select = _select;
		if (this._select) this.id = this._select._registerOption();
	}
	set ngValue(value) {
		if (this._select == null) return;
		this._select._optionMap.set(this.id, value);
		this._setElementValue(_buildValueString$1(this.id, value));
		this._select._writeValueAfterRender();
	}
	set value(value) {
		this._setElementValue(value);
		this._select?._writeValueAfterRender();
	}
	_setElementValue(value) {
		this._renderer.setProperty(this._element.nativeElement, "value", value);
	}
	ngOnDestroy() {
		this._select?._optionMap.delete(this.id);
		this._select?._writeValueAfterRender();
	}
	static ɵfac = function NgSelectOption_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || NgSelectOption)(ɵɵdirectiveInject(ElementRef), ɵɵdirectiveInject(Renderer2), ɵɵdirectiveInject(SelectControlValueAccessor, 9));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: NgSelectOption,
		selectors: [["option"]],
		inputs: {
			ngValue: "ngValue",
			value: "value"
		},
		standalone: false
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgSelectOption, [{
		type: Directive,
		args: [{
			selector: "option",
			standalone: false
		}]
	}], () => [
		{ type: ElementRef },
		{ type: Renderer2 },
		{
			type: SelectControlValueAccessor,
			decorators: [{ type: Optional }, { type: Host }]
		}
	], {
		ngValue: [{
			type: Input,
			args: ["ngValue"]
		}],
		value: [{
			type: Input,
			args: ["value"]
		}]
	});
})();
var SELECT_MULTIPLE_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => SelectMultipleControlValueAccessor),
	multi: true
};
function _buildValueString(id, value) {
	if (id == null) return `${value}`;
	if (typeof value === "string") value = `'${value}'`;
	if (value && typeof value === "object") value = "Object";
	return `${id}: ${value}`.slice(0, 50);
}
function _extractId(valueString) {
	return valueString.split(":")[0];
}
var SelectMultipleControlValueAccessor = class SelectMultipleControlValueAccessor extends BuiltInControlValueAccessor {
	value;
	_optionMap = /* @__PURE__ */ new Map();
	_idCounter = 0;
	set compareWith(fn) {
		if (typeof fn !== "function" && (typeof ngDevMode === "undefined" || ngDevMode)) throw new RuntimeError(1201, `compareWith must be a function, but received ${JSON.stringify(fn)}`);
		this._compareWith = fn;
	}
	_compareWith = Object.is;
	writeValue(value) {
		this.value = value;
		let optionSelectedStateSetter;
		if (Array.isArray(value)) {
			const ids = value.map((v) => this._getOptionId(v));
			optionSelectedStateSetter = (opt, id) => {
				opt._setSelected(ids.indexOf(id) > -1);
			};
		} else optionSelectedStateSetter = (opt) => {
			opt._setSelected(false);
		};
		this._optionMap.forEach(optionSelectedStateSetter);
	}
	registerOnChange(fn) {
		this.onChange = (element) => {
			const selected = [];
			const selectedOptions = element.selectedOptions;
			if (selectedOptions !== void 0) {
				const options = selectedOptions;
				for (let i = 0; i < options.length; i++) {
					const opt = options[i];
					const val = this._getOptionValue(opt.value);
					selected.push(val);
				}
			} else {
				const options = element.options;
				for (let i = 0; i < options.length; i++) {
					const opt = options[i];
					if (opt.selected) {
						const val = this._getOptionValue(opt.value);
						selected.push(val);
					}
				}
			}
			this.value = selected;
			fn(selected);
		};
	}
	_registerOption(value) {
		const id = (this._idCounter++).toString();
		this._optionMap.set(id, value);
		return id;
	}
	_getOptionId(value) {
		for (const id of this._optionMap.keys()) if (this._compareWith(this._optionMap.get(id)._value, value)) return id;
		return null;
	}
	_getOptionValue(valueString) {
		const id = _extractId(valueString);
		return this._optionMap.has(id) ? this._optionMap.get(id)._value : valueString;
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵSelectMultipleControlValueAccessor_BaseFactory;
		return function SelectMultipleControlValueAccessor_Factory(__ngFactoryType__) {
			return (ɵSelectMultipleControlValueAccessor_BaseFactory || (ɵSelectMultipleControlValueAccessor_BaseFactory = ɵɵgetInheritedFactory(SelectMultipleControlValueAccessor)))(__ngFactoryType__ || SelectMultipleControlValueAccessor);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: SelectMultipleControlValueAccessor,
		selectors: [
			[
				"select",
				"multiple",
				"",
				"formControlName",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"select",
				"multiple",
				"",
				"formControl",
				"",
				3,
				"ngNoCva",
				""
			],
			[
				"select",
				"multiple",
				"",
				"ngModel",
				"",
				3,
				"ngNoCva",
				""
			]
		],
		hostBindings: function SelectMultipleControlValueAccessor_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("change", function SelectMultipleControlValueAccessor_change_HostBindingHandler($event) {
				return ctx.onChange($event.target);
			})("blur", function SelectMultipleControlValueAccessor_blur_HostBindingHandler() {
				return ctx.onTouched();
			});
		},
		inputs: { compareWith: "compareWith" },
		standalone: false,
		features: [ɵɵProvidersFeature([SELECT_MULTIPLE_VALUE_ACCESSOR]), ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SelectMultipleControlValueAccessor, [{
		type: Directive,
		args: [{
			selector: "select[multiple]:not([ngNoCva])[formControlName],select[multiple]:not([ngNoCva])[formControl],select[multiple]:not([ngNoCva])[ngModel]",
			host: {
				"(change)": "onChange($event.target)",
				"(blur)": "onTouched()"
			},
			providers: [SELECT_MULTIPLE_VALUE_ACCESSOR],
			standalone: false
		}]
	}], null, { compareWith: [{ type: Input }] });
})();
var ɵNgSelectMultipleOption = class ɵNgSelectMultipleOption {
	_element;
	_renderer;
	_select;
	id;
	_value;
	constructor(_element, _renderer, _select) {
		this._element = _element;
		this._renderer = _renderer;
		this._select = _select;
		if (this._select) this.id = this._select._registerOption(this);
	}
	set ngValue(value) {
		if (this._select == null) return;
		this._value = value;
		this._setElementValue(_buildValueString(this.id, value));
		this._select.writeValue(this._select.value);
	}
	set value(value) {
		if (this._select) {
			this._value = value;
			this._setElementValue(_buildValueString(this.id, value));
			this._select.writeValue(this._select.value);
		} else this._setElementValue(value);
	}
	_setElementValue(value) {
		this._renderer.setProperty(this._element.nativeElement, "value", value);
	}
	_setSelected(selected) {
		this._renderer.setProperty(this._element.nativeElement, "selected", selected);
	}
	ngOnDestroy() {
		if (this._select) {
			this._select._optionMap.delete(this.id);
			this._select.writeValue(this._select.value);
		}
	}
	static ɵfac = function ɵNgSelectMultipleOption_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || ɵNgSelectMultipleOption)(ɵɵdirectiveInject(ElementRef), ɵɵdirectiveInject(Renderer2), ɵɵdirectiveInject(SelectMultipleControlValueAccessor, 9));
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: ɵNgSelectMultipleOption,
		selectors: [["option"]],
		inputs: {
			ngValue: "ngValue",
			value: "value"
		},
		standalone: false
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ɵNgSelectMultipleOption, [{
		type: Directive,
		args: [{
			selector: "option",
			standalone: false
		}]
	}], () => [
		{ type: ElementRef },
		{ type: Renderer2 },
		{
			type: SelectMultipleControlValueAccessor,
			decorators: [{ type: Optional }, { type: Host }]
		}
	], {
		ngValue: [{
			type: Input,
			args: ["ngValue"]
		}],
		value: [{
			type: Input,
			args: ["value"]
		}]
	});
})();
var SHARED_FORM_DIRECTIVES = [
	ɵNgNoValidate,
	NgSelectOption,
	ɵNgSelectMultipleOption,
	DefaultValueAccessor,
	NumberValueAccessor,
	RangeValueAccessor,
	CheckboxControlValueAccessor,
	SelectControlValueAccessor,
	SelectMultipleControlValueAccessor,
	RadioControlValueAccessor,
	NgControlStatus,
	NgControlStatusGroup,
	RequiredValidator,
	MinLengthValidator,
	MaxLengthValidator,
	PatternValidator,
	CheckboxRequiredValidator,
	EmailValidator,
	MinValidator,
	MaxValidator
];
var TEMPLATE_DRIVEN_DIRECTIVES = [
	NgModel,
	NgModelGroup,
	NgForm
];
var REACTIVE_DRIVEN_DIRECTIVES = [
	FormControlDirective,
	FormGroupDirective,
	FormArrayDirective,
	FormControlName,
	FormGroupName,
	FormArrayName
];
var ɵInternalFormsSharedModule = class ɵInternalFormsSharedModule {
	static ɵfac = function ɵInternalFormsSharedModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || ɵInternalFormsSharedModule)();
	};
	static ɵmod = /* @__PURE__ */ ɵɵdefineNgModule({
		type: ɵInternalFormsSharedModule,
		declarations: [
			ɵNgNoValidate,
			NgSelectOption,
			ɵNgSelectMultipleOption,
			DefaultValueAccessor,
			NumberValueAccessor,
			RangeValueAccessor,
			CheckboxControlValueAccessor,
			SelectControlValueAccessor,
			SelectMultipleControlValueAccessor,
			RadioControlValueAccessor,
			NgControlStatus,
			NgControlStatusGroup,
			RequiredValidator,
			MinLengthValidator,
			MaxLengthValidator,
			PatternValidator,
			CheckboxRequiredValidator,
			EmailValidator,
			MinValidator,
			MaxValidator
		],
		exports: [
			ɵNgNoValidate,
			NgSelectOption,
			ɵNgSelectMultipleOption,
			DefaultValueAccessor,
			NumberValueAccessor,
			RangeValueAccessor,
			CheckboxControlValueAccessor,
			SelectControlValueAccessor,
			SelectMultipleControlValueAccessor,
			RadioControlValueAccessor,
			NgControlStatus,
			NgControlStatusGroup,
			RequiredValidator,
			MinLengthValidator,
			MaxLengthValidator,
			PatternValidator,
			CheckboxRequiredValidator,
			EmailValidator,
			MinValidator,
			MaxValidator
		]
	});
	static ɵinj = /* @__PURE__ */ ɵɵdefineInjector({});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ɵInternalFormsSharedModule, [{
		type: NgModule,
		args: [{
			declarations: SHARED_FORM_DIRECTIVES,
			exports: SHARED_FORM_DIRECTIVES
		}]
	}], null, null);
})();
function isAbstractControlOptions(options) {
	return !!options && (options.asyncValidators !== void 0 || options.validators !== void 0 || options.updateOn !== void 0);
}
var FormBuilder = class FormBuilder {
	useNonNullable = false;
	get nonNullable() {
		const nnfb = new FormBuilder();
		nnfb.useNonNullable = true;
		return nnfb;
	}
	group(controls, options = null) {
		const reducedControls = this._reduceControls(controls);
		let newOptions = {};
		if (isAbstractControlOptions(options)) newOptions = options;
		else if (options !== null) {
			newOptions.validators = options.validator;
			newOptions.asyncValidators = options.asyncValidator;
		}
		return new FormGroup(reducedControls, newOptions);
	}
	record(controls, options = null) {
		return new FormRecord(this._reduceControls(controls), options);
	}
	control(formState, validatorOrOpts, asyncValidator) {
		let newOptions = {};
		if (!this.useNonNullable) return new FormControl(formState, validatorOrOpts, asyncValidator);
		if (isAbstractControlOptions(validatorOrOpts)) newOptions = validatorOrOpts;
		else {
			newOptions.validators = validatorOrOpts;
			newOptions.asyncValidators = asyncValidator;
		}
		return new FormControl(formState, {
			...newOptions,
			nonNullable: true
		});
	}
	array(controls, validatorOrOpts, asyncValidator) {
		return new FormArray(controls.map((c) => this._createControl(c)), validatorOrOpts, asyncValidator);
	}
	_reduceControls(controls) {
		const createdControls = {};
		Object.keys(controls).forEach((controlName) => {
			createdControls[controlName] = this._createControl(controls[controlName]);
		});
		return createdControls;
	}
	_createControl(controls) {
		if (controls instanceof FormControl) return controls;
		else if (controls instanceof AbstractControl) return controls;
		else if (Array.isArray(controls)) {
			const value = controls[0];
			const validator = controls.length > 1 ? controls[1] : null;
			const asyncValidator = controls.length > 2 ? controls[2] : null;
			return this.control(value, validator, asyncValidator);
		} else return this.control(controls);
	}
	static ɵfac = function FormBuilder_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || FormBuilder)();
	};
	static ɵprov = /* @__PURE__ */ ɵɵdefineService({
		token: FormBuilder,
		factory: FormBuilder.ɵfac
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormBuilder, [{ type: Service }], null, null);
})();
var NonNullableFormBuilder = class NonNullableFormBuilder {
	static ɵfac = function NonNullableFormBuilder_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || NonNullableFormBuilder)();
	};
	static ɵprov = /* @__PURE__ */ ɵɵdefineService({
		token: NonNullableFormBuilder,
		factory: () => (() => inject(FormBuilder).nonNullable)()
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NonNullableFormBuilder, [{
		type: Service,
		args: [{ factory: () => inject(FormBuilder).nonNullable }]
	}], null, null);
})();
var UntypedFormBuilder = class UntypedFormBuilder extends FormBuilder {
	group(controlsConfig, options = null) {
		return super.group(controlsConfig, options);
	}
	control(formState, validatorOrOpts, asyncValidator) {
		return super.control(formState, validatorOrOpts, asyncValidator);
	}
	array(controlsConfig, validatorOrOpts, asyncValidator) {
		return super.array(controlsConfig, validatorOrOpts, asyncValidator);
	}
	static ɵfac = function UntypedFormBuilder_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || UntypedFormBuilder)();
	};
	static ɵprov = /* @__PURE__ */ ɵɵdefineService({
		token: UntypedFormBuilder,
		factory: UntypedFormBuilder.ɵfac
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(UntypedFormBuilder, [{ type: Service }], null, null);
})();
var FormsModule = class FormsModule {
	static withConfig(opts) {
		return {
			ngModule: FormsModule,
			providers: [{
				provide: CALL_SET_DISABLED_STATE,
				useValue: opts.callSetDisabledState ?? setDisabledStateDefault
			}]
		};
	}
	static ɵfac = function FormsModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || FormsModule)();
	};
	static ɵmod = /* @__PURE__ */ ɵɵdefineNgModule({
		type: FormsModule,
		declarations: [
			NgModel,
			NgModelGroup,
			NgForm
		],
		exports: [
			ɵInternalFormsSharedModule,
			NgModel,
			NgModelGroup,
			NgForm
		]
	});
	static ɵinj = /* @__PURE__ */ ɵɵdefineInjector({ imports: [ɵInternalFormsSharedModule] });
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FormsModule, [{
		type: NgModule,
		args: [{
			declarations: TEMPLATE_DRIVEN_DIRECTIVES,
			exports: [ɵInternalFormsSharedModule, TEMPLATE_DRIVEN_DIRECTIVES]
		}]
	}], null, null);
})();
var ReactiveFormsModule = class ReactiveFormsModule {
	static withConfig(opts) {
		return {
			ngModule: ReactiveFormsModule,
			providers: [{
				provide: NG_MODEL_WITH_FORM_CONTROL_WARNING,
				useValue: opts.warnOnNgModelWithFormControl ?? "always"
			}, {
				provide: CALL_SET_DISABLED_STATE,
				useValue: opts.callSetDisabledState ?? setDisabledStateDefault
			}]
		};
	}
	static ɵfac = function ReactiveFormsModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || ReactiveFormsModule)();
	};
	static ɵmod = /* @__PURE__ */ ɵɵdefineNgModule({
		type: ReactiveFormsModule,
		declarations: [
			FormControlDirective,
			FormGroupDirective,
			FormArrayDirective,
			FormControlName,
			FormGroupName,
			FormArrayName
		],
		exports: [
			ɵInternalFormsSharedModule,
			FormControlDirective,
			FormGroupDirective,
			FormArrayDirective,
			FormControlName,
			FormGroupName,
			FormArrayName
		]
	});
	static ɵinj = /* @__PURE__ */ ɵɵdefineInjector({ imports: [ɵInternalFormsSharedModule] });
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ReactiveFormsModule, [{
		type: NgModule,
		args: [{
			declarations: [REACTIVE_DRIVEN_DIRECTIVES],
			exports: [ɵInternalFormsSharedModule, REACTIVE_DRIVEN_DIRECTIVES]
		}]
	}], null, null);
})();
//#endregion
//#region node_modules/@angular/material/fesm2022/divider.mjs
var MatDivider = class MatDivider {
	get vertical() {
		return this._vertical;
	}
	set vertical(value) {
		this._vertical = coerceBooleanProperty(value);
	}
	_vertical = false;
	get inset() {
		return this._inset;
	}
	set inset(value) {
		this._inset = coerceBooleanProperty(value);
	}
	_inset = false;
	static ɵfac = function MatDivider_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatDivider)();
	};
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatDivider,
		selectors: [["mat-divider"]],
		hostAttrs: [
			"role",
			"separator",
			1,
			"mat-divider"
		],
		hostVars: 7,
		hostBindings: function MatDivider_HostBindings(rf, ctx) {
			if (rf & 2) {
				ɵɵattribute("aria-orientation", ctx.vertical ? "vertical" : "horizontal");
				ɵɵclassProp("mat-divider-vertical", ctx.vertical)("mat-divider-horizontal", !ctx.vertical)("mat-divider-inset", ctx.inset);
			}
		},
		inputs: {
			vertical: "vertical",
			inset: "inset"
		},
		decls: 0,
		vars: 0,
		template: function MatDivider_Template(rf, ctx) {},
		styles: [".mat-divider {\n  display: block;\n  margin: 0;\n  border-top-style: solid;\n  border-top-color: var(--%NS%mat-divider-color, var(--%NS%mat-sys-outline-variant));\n  border-top-width: var(--%NS%mat-divider-width, 1px);\n}\n.mat-divider.mat-divider-vertical {\n  border-top: 0;\n  border-right-style: solid;\n  border-right-color: var(--%NS%mat-divider-color, var(--%NS%mat-sys-outline-variant));\n  border-right-width: var(--%NS%mat-divider-width, 1px);\n}\n.mat-divider.mat-divider-inset {\n  margin-left: 80px;\n}\n[dir=rtl] .mat-divider.mat-divider-inset {\n  margin-left: auto;\n  margin-right: 80px;\n}\n"],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatDivider, [{
		type: Component,
		args: [{
			selector: "mat-divider",
			host: {
				"role": "separator",
				"[attr.aria-orientation]": "vertical ? \"vertical\" : \"horizontal\"",
				"[class.mat-divider-vertical]": "vertical",
				"[class.mat-divider-horizontal]": "!vertical",
				"[class.mat-divider-inset]": "inset",
				"class": "mat-divider"
			},
			template: "",
			encapsulation: ViewEncapsulation.None,
			styles: [".mat-divider {\n  display: block;\n  margin: 0;\n  border-top-style: solid;\n  border-top-color: var(--mat-divider-color, var(--mat-sys-outline-variant));\n  border-top-width: var(--mat-divider-width, 1px);\n}\n.mat-divider.mat-divider-vertical {\n  border-top: 0;\n  border-right-style: solid;\n  border-right-color: var(--mat-divider-color, var(--mat-sys-outline-variant));\n  border-right-width: var(--mat-divider-width, 1px);\n}\n.mat-divider.mat-divider-inset {\n  margin-left: 80px;\n}\n[dir=rtl] .mat-divider.mat-divider-inset {\n  margin-left: auto;\n  margin-right: 80px;\n}\n"]
		}]
	}], null, {
		vertical: [{ type: Input }],
		inset: [{ type: Input }]
	});
})();
var MatDividerModule = class MatDividerModule {
	static ɵfac = function MatDividerModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatDividerModule)();
	};
	static ɵmod = /* @__PURE__ */ ɵɵdefineNgModule({
		type: MatDividerModule,
		imports: [MatDivider],
		exports: [MatDivider, BidiModule]
	});
	static ɵinj = /* @__PURE__ */ ɵɵdefineInjector({ imports: [BidiModule] });
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatDividerModule, [{
		type: NgModule,
		args: [{
			imports: [MatDivider],
			exports: [MatDivider, BidiModule]
		}]
	}], null, null);
})();
//#endregion
//#region node_modules/@angular/material/fesm2022/_pseudo-checkbox-chunk.mjs
var MatPseudoCheckbox = class MatPseudoCheckbox {
	_animationsDisabled = _animationsDisabled();
	state = "unchecked";
	disabled = false;
	appearance = "full";
	static ɵfac = function MatPseudoCheckbox_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatPseudoCheckbox)();
	};
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatPseudoCheckbox,
		selectors: [["mat-pseudo-checkbox"]],
		hostAttrs: [1, "mat-pseudo-checkbox"],
		hostVars: 12,
		hostBindings: function MatPseudoCheckbox_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵclassProp("mat-pseudo-checkbox-indeterminate", ctx.state === "indeterminate")("mat-pseudo-checkbox-checked", ctx.state === "checked")("mat-pseudo-checkbox-disabled", ctx.disabled)("mat-pseudo-checkbox-minimal", ctx.appearance === "minimal")("mat-pseudo-checkbox-full", ctx.appearance === "full")("_mat-animation-noopable", ctx._animationsDisabled);
		},
		inputs: {
			state: "state",
			disabled: "disabled",
			appearance: "appearance"
		},
		decls: 0,
		vars: 0,
		template: function MatPseudoCheckbox_Template(rf, ctx) {},
		styles: [".mat-pseudo-checkbox {\n  border-radius: 2px;\n  cursor: pointer;\n  display: inline-block;\n  vertical-align: middle;\n  box-sizing: border-box;\n  position: relative;\n  flex-shrink: 0;\n  transition: border-color 90ms cubic-bezier(0, 0, 0.2, 0.1), background-color 90ms cubic-bezier(0, 0, 0.2, 0.1);\n}\n.mat-pseudo-checkbox::after {\n  position: absolute;\n  opacity: 0;\n  content: \"\";\n  border-bottom: 2px solid currentColor;\n  transition: opacity 90ms cubic-bezier(0, 0, 0.2, 0.1);\n}\n.mat-pseudo-checkbox._mat-animation-noopable {\n  transition: none !important;\n  animation: none !important;\n}\n.mat-pseudo-checkbox._mat-animation-noopable::after {\n  transition: none;\n}\n\n.mat-pseudo-checkbox-disabled {\n  cursor: default;\n}\n\n.mat-pseudo-checkbox-indeterminate::after {\n  left: 1px;\n  opacity: 1;\n  border-radius: 2px;\n}\n\n.mat-pseudo-checkbox-checked::after {\n  left: 1px;\n  border-left: 2px solid currentColor;\n  transform: rotate(-45deg);\n  opacity: 1;\n  box-sizing: content-box;\n}\n\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-checked::after, .mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-indeterminate::after {\n  color: var(--%NS%mat-pseudo-checkbox-minimal-selected-checkmark-color, var(--%NS%mat-sys-primary));\n}\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-checked.mat-pseudo-checkbox-disabled::after, .mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-indeterminate.mat-pseudo-checkbox-disabled::after {\n  color: var(--%NS%mat-pseudo-checkbox-minimal-disabled-selected-checkmark-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));\n}\n\n.mat-pseudo-checkbox-full {\n  border-color: var(--%NS%mat-pseudo-checkbox-full-unselected-icon-color, var(--%NS%mat-sys-on-surface-variant));\n  border-width: 2px;\n  border-style: solid;\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-disabled {\n  border-color: var(--%NS%mat-pseudo-checkbox-full-disabled-unselected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate {\n  background-color: var(--%NS%mat-pseudo-checkbox-full-selected-icon-color, var(--%NS%mat-sys-primary));\n  border-color: transparent;\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked::after, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate::after {\n  color: var(--%NS%mat-pseudo-checkbox-full-selected-checkmark-color, var(--%NS%mat-sys-on-primary));\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked.mat-pseudo-checkbox-disabled, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate.mat-pseudo-checkbox-disabled {\n  background-color: var(--%NS%mat-pseudo-checkbox-full-disabled-selected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked.mat-pseudo-checkbox-disabled::after, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate.mat-pseudo-checkbox-disabled::after {\n  color: var(--%NS%mat-pseudo-checkbox-full-disabled-selected-checkmark-color, var(--%NS%mat-sys-surface));\n}\n\n.mat-pseudo-checkbox {\n  width: 18px;\n  height: 18px;\n}\n\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-checked::after {\n  width: 14px;\n  height: 6px;\n  transform-origin: center;\n  top: -4.2426406871px;\n  left: 0;\n  bottom: 0;\n  right: 0;\n  margin: auto;\n}\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-indeterminate::after {\n  top: 8px;\n  width: 16px;\n}\n\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked::after {\n  width: 10px;\n  height: 4px;\n  transform-origin: center;\n  top: -2.8284271247px;\n  left: 0;\n  bottom: 0;\n  right: 0;\n  margin: auto;\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate::after {\n  top: 6px;\n  width: 12px;\n}\n"],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatPseudoCheckbox, [{
		type: Component,
		args: [{
			encapsulation: ViewEncapsulation.None,
			selector: "mat-pseudo-checkbox",
			template: "",
			host: {
				"class": "mat-pseudo-checkbox",
				"[class.mat-pseudo-checkbox-indeterminate]": "state === \"indeterminate\"",
				"[class.mat-pseudo-checkbox-checked]": "state === \"checked\"",
				"[class.mat-pseudo-checkbox-disabled]": "disabled",
				"[class.mat-pseudo-checkbox-minimal]": "appearance === \"minimal\"",
				"[class.mat-pseudo-checkbox-full]": "appearance === \"full\"",
				"[class._mat-animation-noopable]": "_animationsDisabled"
			},
			styles: [".mat-pseudo-checkbox {\n  border-radius: 2px;\n  cursor: pointer;\n  display: inline-block;\n  vertical-align: middle;\n  box-sizing: border-box;\n  position: relative;\n  flex-shrink: 0;\n  transition: border-color 90ms cubic-bezier(0, 0, 0.2, 0.1), background-color 90ms cubic-bezier(0, 0, 0.2, 0.1);\n}\n.mat-pseudo-checkbox::after {\n  position: absolute;\n  opacity: 0;\n  content: \"\";\n  border-bottom: 2px solid currentColor;\n  transition: opacity 90ms cubic-bezier(0, 0, 0.2, 0.1);\n}\n.mat-pseudo-checkbox._mat-animation-noopable {\n  transition: none !important;\n  animation: none !important;\n}\n.mat-pseudo-checkbox._mat-animation-noopable::after {\n  transition: none;\n}\n\n.mat-pseudo-checkbox-disabled {\n  cursor: default;\n}\n\n.mat-pseudo-checkbox-indeterminate::after {\n  left: 1px;\n  opacity: 1;\n  border-radius: 2px;\n}\n\n.mat-pseudo-checkbox-checked::after {\n  left: 1px;\n  border-left: 2px solid currentColor;\n  transform: rotate(-45deg);\n  opacity: 1;\n  box-sizing: content-box;\n}\n\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-checked::after, .mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-indeterminate::after {\n  color: var(--mat-pseudo-checkbox-minimal-selected-checkmark-color, var(--mat-sys-primary));\n}\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-checked.mat-pseudo-checkbox-disabled::after, .mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-indeterminate.mat-pseudo-checkbox-disabled::after {\n  color: var(--mat-pseudo-checkbox-minimal-disabled-selected-checkmark-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));\n}\n\n.mat-pseudo-checkbox-full {\n  border-color: var(--mat-pseudo-checkbox-full-unselected-icon-color, var(--mat-sys-on-surface-variant));\n  border-width: 2px;\n  border-style: solid;\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-disabled {\n  border-color: var(--mat-pseudo-checkbox-full-disabled-unselected-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate {\n  background-color: var(--mat-pseudo-checkbox-full-selected-icon-color, var(--mat-sys-primary));\n  border-color: transparent;\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked::after, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate::after {\n  color: var(--mat-pseudo-checkbox-full-selected-checkmark-color, var(--mat-sys-on-primary));\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked.mat-pseudo-checkbox-disabled, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate.mat-pseudo-checkbox-disabled {\n  background-color: var(--mat-pseudo-checkbox-full-disabled-selected-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked.mat-pseudo-checkbox-disabled::after, .mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate.mat-pseudo-checkbox-disabled::after {\n  color: var(--mat-pseudo-checkbox-full-disabled-selected-checkmark-color, var(--mat-sys-surface));\n}\n\n.mat-pseudo-checkbox {\n  width: 18px;\n  height: 18px;\n}\n\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-checked::after {\n  width: 14px;\n  height: 6px;\n  transform-origin: center;\n  top: -4.2426406871px;\n  left: 0;\n  bottom: 0;\n  right: 0;\n  margin: auto;\n}\n.mat-pseudo-checkbox-minimal.mat-pseudo-checkbox-indeterminate::after {\n  top: 8px;\n  width: 16px;\n}\n\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-checked::after {\n  width: 10px;\n  height: 4px;\n  transform-origin: center;\n  top: -2.8284271247px;\n  left: 0;\n  bottom: 0;\n  right: 0;\n  margin: auto;\n}\n.mat-pseudo-checkbox-full.mat-pseudo-checkbox-indeterminate::after {\n  top: 6px;\n  width: 12px;\n}\n"]
		}]
	}], null, {
		state: [{ type: Input }],
		disabled: [{ type: Input }],
		appearance: [{ type: Input }]
	});
})();
//#endregion
//#region node_modules/@angular/material/fesm2022/_pseudo-checkbox-module-chunk.mjs
var MatPseudoCheckboxModule = class MatPseudoCheckboxModule {
	static ɵfac = function MatPseudoCheckboxModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatPseudoCheckboxModule)();
	};
	static ɵmod = /* @__PURE__ */ ɵɵdefineNgModule({
		type: MatPseudoCheckboxModule,
		imports: [MatPseudoCheckbox],
		exports: [MatPseudoCheckbox, BidiModule]
	});
	static ɵinj = /* @__PURE__ */ ɵɵdefineInjector({ imports: [BidiModule] });
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatPseudoCheckboxModule, [{
		type: NgModule,
		args: [{
			imports: [MatPseudoCheckbox],
			exports: [MatPseudoCheckbox, BidiModule]
		}]
	}], null, null);
})();
//#endregion
//#region node_modules/@angular/material/fesm2022/list.mjs
var _c0 = ["*"];
var _c1 = ".mdc-list {\n  margin: 0;\n  padding: 8px 0;\n  list-style-type: none;\n}\n.mdc-list:focus {\n  outline: none;\n}\n\n.mdc-list-item {\n  display: flex;\n  position: relative;\n  justify-content: flex-start;\n  overflow: hidden;\n  padding: 0;\n  align-items: stretch;\n  cursor: pointer;\n  padding-left: 16px;\n  padding-right: 16px;\n  background-color: var(--%NS%mat-list-list-item-container-color, transparent);\n  border-radius: var(--%NS%mat-list-list-item-container-shape, var(--%NS%mat-sys-corner-none));\n}\n.mdc-list-item.mdc-list-item--selected {\n  background-color: var(--%NS%mat-list-list-item-selected-container-color);\n}\n.mdc-list-item:focus {\n  outline: 0;\n}\n.mdc-list-item.mdc-list-item--disabled {\n  cursor: auto;\n}\n.mdc-list-item.mdc-list-item--with-one-line {\n  height: var(--%NS%mat-list-list-item-one-line-container-height, 48px);\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__start {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-two-lines {\n  height: var(--%NS%mat-list-list-item-two-line-container-height, 64px);\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-three-lines {\n  height: var(--%NS%mat-list-list-item-three-line-container-height, 88px);\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--%NS%selected::before, .mdc-list-item.mdc-list-item--%NS%selected:focus::before, .mdc-list-item:not(.mdc-list-item--selected):focus::before {\n  position: absolute;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n  content: \"\";\n  pointer-events: none;\n}\n\na.mdc-list-item {\n  color: inherit;\n  text-decoration: none;\n}\n\n.mdc-list-item__start {\n  fill: currentColor;\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--%NS%mat-list-list-item-leading-icon-color, var(--%NS%mat-sys-on-surface-variant));\n  width: var(--%NS%mat-list-list-item-leading-icon-size, 24px);\n  height: var(--%NS%mat-list-list-item-leading-icon-size, 24px);\n  margin-left: 16px;\n  margin-right: 32px;\n}\n[dir=rtl] .mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-left: 32px;\n  margin-right: 16px;\n}\n.mdc-list-item--%NS%with-leading-icon:hover .mdc-list-item__start {\n  color: var(--%NS%mat-list-list-item-hover-leading-icon-color);\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  width: var(--%NS%mat-list-list-item-leading-avatar-size, 40px);\n  height: var(--%NS%mat-list-list-item-leading-avatar-size, 40px);\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start, [dir=rtl] .mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n\n.mdc-list-item__end {\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  font-family: var(--%NS%mat-list-list-item-trailing-supporting-text-font, var(--%NS%mat-sys-label-small-font));\n  line-height: var(--%NS%mat-list-list-item-trailing-supporting-text-line-height, var(--%NS%mat-sys-label-small-line-height));\n  font-size: var(--%NS%mat-list-list-item-trailing-supporting-text-size, var(--%NS%mat-sys-label-small-size));\n  font-weight: var(--%NS%mat-list-list-item-trailing-supporting-text-weight, var(--%NS%mat-sys-label-small-weight));\n  letter-spacing: var(--%NS%mat-list-list-item-trailing-supporting-text-tracking, var(--%NS%mat-sys-label-small-tracking));\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-trailing-icon-color, var(--%NS%mat-sys-on-surface-variant));\n  width: var(--%NS%mat-list-list-item-trailing-icon-size, 24px);\n  height: var(--%NS%mat-list-list-item-trailing-icon-size, 24px);\n}\n.mdc-list-item--%NS%with-trailing-icon:hover .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-hover-trailing-icon-color);\n}\n.mdc-list-item.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-trailing-supporting-text-color, var(--%NS%mat-sys-on-surface-variant));\n}\n.mdc-list-item--selected.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-selected-trailing-icon-color, var(--%NS%mat-sys-primary));\n}\n\n.mdc-list-item__content {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  align-self: center;\n  flex: 1;\n  pointer-events: none;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__content, .mdc-list-item--with-three-lines .mdc-list-item__content {\n  align-self: stretch;\n}\n\n.mdc-list-item__primary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  color: var(--%NS%mat-list-list-item-label-text-color, var(--%NS%mat-sys-on-surface));\n  font-family: var(--%NS%mat-list-list-item-label-text-font, var(--%NS%mat-sys-body-large-font));\n  line-height: var(--%NS%mat-list-list-item-label-text-line-height, var(--%NS%mat-sys-body-large-line-height));\n  font-size: var(--%NS%mat-list-list-item-label-text-size, var(--%NS%mat-sys-body-large-size));\n  font-weight: var(--%NS%mat-list-list-item-label-text-weight, var(--%NS%mat-sys-body-large-weight));\n  letter-spacing: var(--%NS%mat-list-list-item-label-text-tracking, var(--%NS%mat-sys-body-large-tracking));\n}\n.mdc-list-item:hover .mdc-list-item__primary-text {\n  color: var(--%NS%mat-list-list-item-hover-label-text-color, var(--%NS%mat-sys-on-surface));\n}\n.mdc-list-item:focus .mdc-list-item__primary-text {\n  color: var(--%NS%mat-list-list-item-focus-label-text-color, var(--%NS%mat-sys-on-surface));\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text, .mdc-list-item--with-three-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n\n.mdc-list-item__secondary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  display: block;\n  margin-top: 0;\n  color: var(--%NS%mat-list-list-item-supporting-text-color, var(--%NS%mat-sys-on-surface-variant));\n  font-family: var(--%NS%mat-list-list-item-supporting-text-font, var(--%NS%mat-sys-body-medium-font));\n  line-height: var(--%NS%mat-list-list-item-supporting-text-line-height, var(--%NS%mat-sys-body-medium-line-height));\n  font-size: var(--%NS%mat-list-list-item-supporting-text-size, var(--%NS%mat-sys-body-medium-size));\n  font-weight: var(--%NS%mat-list-list-item-supporting-text-weight, var(--%NS%mat-sys-body-medium-weight));\n  letter-spacing: var(--%NS%mat-list-list-item-supporting-text-tracking, var(--%NS%mat-sys-body-medium-tracking));\n}\n.mdc-list-item__secondary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-three-lines .mdc-list-item__secondary-text {\n  white-space: normal;\n  line-height: 20px;\n}\n.mdc-list-item--with-overline .mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: auto;\n}\n\n.mdc-list-item--with-leading-radio.mdc-list-item,\n.mdc-list-item--with-leading-checkbox.mdc-list-item,\n.mdc-list-item--with-leading-icon.mdc-list-item,\n.mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-checkbox.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-icon.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-trailing-icon.mdc-list-item, [dir=rtl] .mdc-list-item--with-trailing-icon.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n}\n\n.mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  -webkit-user-select: none;\n  user-select: none;\n  margin-left: 28px;\n  margin-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 28px;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end {\n  display: block;\n  line-height: normal;\n  align-self: flex-start;\n  margin-top: 0;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end::before, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-leading-radio .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio .mdc-list-item__start,\n[dir=rtl] .mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-item--with-trailing-radio.mdc-list-item,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-left: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, [dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-radio .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio .mdc-list-item__end,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-three-lines .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-group__subheader {\n  margin: 0.75rem 16px;\n}\n\n.mdc-list-item--disabled .mdc-list-item__start,\n.mdc-list-item--disabled .mdc-list-item__content,\n.mdc-list-item--disabled .mdc-list-item__end {\n  opacity: 1;\n}\n.mdc-list-item--disabled .mdc-list-item__primary-text,\n.mdc-list-item--disabled .mdc-list-item__secondary-text {\n  opacity: var(--%NS%mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n.mdc-list-item--disabled.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--%NS%mat-list-list-item-disabled-leading-icon-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-disabled-leading-icon-opacity, 0.38);\n}\n.mdc-list-item--disabled.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-disabled-trailing-icon-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-disabled-trailing-icon-opacity, 0.38);\n}\n\n.mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing, [dir=rtl] .mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing {\n  padding-left: 0;\n  padding-right: 0;\n}\n\n.mdc-list-item.mdc-list-item--disabled .mdc-list-item__primary-text {\n  color: var(--%NS%mat-list-list-item-disabled-label-text-color, var(--%NS%mat-sys-on-surface));\n}\n\n.mdc-list-item:hover::before {\n  background-color: var(--%NS%mat-list-list-item-hover-state-layer-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));\n}\n\n.mdc-list-item.mdc-list-item--%NS%disabled::before {\n  background-color: var(--%NS%mat-list-list-item-disabled-state-layer-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-disabled-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item:focus::before {\n  background-color: var(--%NS%mat-list-list-item-focus-state-layer-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item--disabled .mdc-radio,\n.mdc-list-item--disabled .mdc-checkbox {\n  opacity: var(--%NS%mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n\n.mdc-list-item--with-leading-avatar .mat-mdc-list-item-avatar {\n  border-radius: var(--%NS%mat-list-list-item-leading-avatar-shape, var(--%NS%mat-sys-corner-full));\n  background-color: var(--%NS%mat-list-list-item-leading-avatar-color, var(--%NS%mat-sys-primary-container));\n}\n\n.mat-mdc-list-item-icon {\n  font-size: var(--%NS%mat-list-list-item-leading-icon-size, 24px);\n}\n\n@media (forced-colors: active) {\n  a.mdc-list-item--%NS%activated::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  a.mdc-list-item--activated [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n\n.mat-mdc-list-base {\n  display: block;\n}\n.mat-mdc-list-base .mdc-list-item__start,\n.mat-mdc-list-base .mdc-list-item__end,\n.mat-mdc-list-base .mdc-list-item__content {\n  pointer-events: auto;\n}\n\n.mat-mdc-list-item,\n.mat-mdc-list-option {\n  width: 100%;\n  box-sizing: border-box;\n  -webkit-tap-highlight-color: transparent;\n}\n.mat-mdc-list-item:not(.mat-mdc-list-item-interactive),\n.mat-mdc-list-option:not(.mat-mdc-list-item-interactive) {\n  cursor: default;\n}\n.mat-mdc-list-item .mat-divider-inset,\n.mat-mdc-list-option .mat-divider-inset {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n}\n.mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n.mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-left: 72px;\n}\n[dir=rtl] .mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n[dir=rtl] .mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-right: 72px;\n}\n\n.mat-mdc-list-item-interactive::before {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  content: \"\";\n  opacity: 0;\n  pointer-events: none;\n  border-radius: inherit;\n}\n\n.mat-mdc-list-item > .mat-focus-indicator {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  pointer-events: none;\n}\n.mat-mdc-list-item:focus-visible > .mat-focus-indicator::before {\n  content: \"\";\n}\n\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-line.mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: normal;\n}\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-unscoped-content.mdc-list-item__secondary-text {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n\nmat-action-list button {\n  background: none;\n  color: inherit;\n  border: none;\n  font: inherit;\n  outline: inherit;\n  -webkit-tap-highlight-color: transparent;\n  text-align: start;\n}\nmat-action-list button::-moz-focus-inner {\n  border: 0;\n}\n\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-inline-start: var(--%NS%mat-list-list-item-leading-icon-start-space, 16px);\n  margin-inline-end: var(--%NS%mat-list-list-item-leading-icon-end-space, 16px);\n}\n\n.mat-mdc-nav-list .mat-mdc-list-item {\n  border-radius: var(--%NS%mat-list-active-indicator-shape, var(--%NS%mat-sys-corner-full));\n  --%NS%mat-focus-indicator-border-radius: var(--%NS%mat-list-active-indicator-shape, var(--%NS%mat-sys-corner-full));\n}\n.mat-mdc-nav-list .mat-mdc-list-item.mdc-list-item--activated {\n  background-color: var(--%NS%mat-list-active-indicator-color, var(--%NS%mat-sys-secondary-container));\n}\n";
var _c2 = ["unscopedContent"];
var _c3 = ["text"];
var _c4 = [
	[[
		"",
		"matListItemAvatar",
		""
	], [
		"",
		"matListItemIcon",
		""
	]],
	[[
		"",
		"matListItemTitle",
		""
	]],
	[[
		"",
		"matListItemLine",
		""
	]],
	"*",
	[[
		"",
		"matListItemMeta",
		""
	]],
	[["mat-divider"]]
];
var _c5 = [
	"[matListItemAvatar],[matListItemIcon]",
	"[matListItemTitle]",
	"[matListItemLine]",
	"*",
	"[matListItemMeta]",
	"mat-divider"
];
var _c6 = [
	[[
		"",
		"matListItemTitle",
		""
	]],
	[[
		"",
		"matListItemLine",
		""
	]],
	"*",
	[["mat-divider"]],
	[[
		"",
		"matListItemAvatar",
		""
	], [
		"",
		"matListItemIcon",
		""
	]]
];
var _c7 = [
	"[matListItemTitle]",
	"[matListItemLine]",
	"*",
	"mat-divider",
	"[matListItemAvatar],[matListItemIcon]"
];
function MatListOption_ng_template_0_Template(rf, ctx) {
	if (rf & 1) ɵɵprojection(0, 4);
}
function MatListOption_ng_template_2_Template(rf, ctx) {
	if (rf & 1) {
		ɵɵelementStart(0, "div", 11);
		ɵɵelement(1, "input", 12);
		ɵɵelementStart(2, "div", 13);
		ɵɵnamespaceSVG();
		ɵɵelementStart(3, "svg", 14);
		ɵɵelement(4, "path", 15);
		ɵɵelementEnd();
		ɵɵnamespaceHTML();
		ɵɵelement(5, "div", 16);
		ɵɵelementEnd()();
	}
	if (rf & 2) {
		const ctx_r0 = ɵɵnextContext();
		ɵɵclassProp("mdc-checkbox--disabled", ctx_r0.disabled);
		ɵɵadvance();
		ɵɵproperty("checked", ctx_r0.selected)("disabled", ctx_r0.disabled);
	}
}
function MatListOption_ng_template_4_Template(rf, ctx) {
	if (rf & 1) {
		ɵɵelementStart(0, "div", 17);
		ɵɵelement(1, "input", 18);
		ɵɵelementStart(2, "div", 19);
		ɵɵelement(3, "div", 20)(4, "div", 21);
		ɵɵelementEnd()();
	}
	if (rf & 2) {
		const ctx_r0 = ɵɵnextContext();
		ɵɵclassProp("mdc-radio--disabled", ctx_r0.disabled);
		ɵɵadvance();
		ɵɵproperty("checked", ctx_r0.selected)("disabled", ctx_r0.disabled);
	}
}
function MatListOption_Conditional_6_ng_template_1_Template(rf, ctx) {}
function MatListOption_Conditional_6_Template(rf, ctx) {
	if (rf & 1) {
		ɵɵelementStart(0, "span", 4);
		ɵɵtemplate(1, MatListOption_Conditional_6_ng_template_1_Template, 0, 0, "ng-template", 6);
		ɵɵelementEnd();
	}
	if (rf & 2) {
		ɵɵnextContext();
		const checkbox_r2 = ɵɵreference(3);
		ɵɵadvance();
		ɵɵproperty("ngTemplateOutlet", checkbox_r2);
	}
}
function MatListOption_Conditional_7_ng_template_1_Template(rf, ctx) {}
function MatListOption_Conditional_7_Template(rf, ctx) {
	if (rf & 1) {
		ɵɵelementStart(0, "span", 5);
		ɵɵtemplate(1, MatListOption_Conditional_7_ng_template_1_Template, 0, 0, "ng-template", 6);
		ɵɵelementEnd();
	}
	if (rf & 2) {
		ɵɵnextContext();
		const radio_r3 = ɵɵreference(5);
		ɵɵadvance();
		ɵɵproperty("ngTemplateOutlet", radio_r3);
	}
}
function MatListOption_Conditional_8_ng_template_0_Template(rf, ctx) {}
function MatListOption_Conditional_8_Template(rf, ctx) {
	if (rf & 1) ɵɵtemplate(0, MatListOption_Conditional_8_ng_template_0_Template, 0, 0, "ng-template", 6);
	if (rf & 2) {
		ɵɵnextContext();
		ɵɵproperty("ngTemplateOutlet", ɵɵreference(1));
	}
}
function MatListOption_Conditional_15_ng_template_1_Template(rf, ctx) {}
function MatListOption_Conditional_15_Template(rf, ctx) {
	if (rf & 1) {
		ɵɵelementStart(0, "span", 9);
		ɵɵtemplate(1, MatListOption_Conditional_15_ng_template_1_Template, 0, 0, "ng-template", 6);
		ɵɵelementEnd();
	}
	if (rf & 2) {
		ɵɵnextContext();
		const checkbox_r2 = ɵɵreference(3);
		ɵɵadvance();
		ɵɵproperty("ngTemplateOutlet", checkbox_r2);
	}
}
function MatListOption_Conditional_16_ng_template_1_Template(rf, ctx) {}
function MatListOption_Conditional_16_Template(rf, ctx) {
	if (rf & 1) {
		ɵɵelementStart(0, "span", 9);
		ɵɵtemplate(1, MatListOption_Conditional_16_ng_template_1_Template, 0, 0, "ng-template", 6);
		ɵɵelementEnd();
	}
	if (rf & 2) {
		ɵɵnextContext();
		const radio_r3 = ɵɵreference(5);
		ɵɵadvance();
		ɵɵproperty("ngTemplateOutlet", radio_r3);
	}
}
function MatListOption_Conditional_17_ng_template_0_Template(rf, ctx) {}
function MatListOption_Conditional_17_Template(rf, ctx) {
	if (rf & 1) ɵɵtemplate(0, MatListOption_Conditional_17_ng_template_0_Template, 0, 0, "ng-template", 6);
	if (rf & 2) {
		ɵɵnextContext();
		ɵɵproperty("ngTemplateOutlet", ɵɵreference(1));
	}
}
var LIST_OPTION = new InjectionToken("ListOption");
var MatListItemTitle = class MatListItemTitle {
	_elementRef = inject(ElementRef);
	static ɵfac = function MatListItemTitle_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatListItemTitle)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListItemTitle,
		selectors: [[
			"",
			"matListItemTitle",
			""
		]],
		hostAttrs: [
			1,
			"mat-mdc-list-item-title",
			"mdc-list-item__primary-text"
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListItemTitle, [{
		type: Directive,
		args: [{
			selector: "[matListItemTitle]",
			host: { "class": "mat-mdc-list-item-title mdc-list-item__primary-text" }
		}]
	}], null, null);
})();
var MatListItemLine = class MatListItemLine {
	_elementRef = inject(ElementRef);
	static ɵfac = function MatListItemLine_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatListItemLine)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListItemLine,
		selectors: [[
			"",
			"matListItemLine",
			""
		]],
		hostAttrs: [
			1,
			"mat-mdc-list-item-line",
			"mdc-list-item__secondary-text"
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListItemLine, [{
		type: Directive,
		args: [{
			selector: "[matListItemLine]",
			host: { "class": "mat-mdc-list-item-line mdc-list-item__secondary-text" }
		}]
	}], null, null);
})();
var MatListItemMeta = class MatListItemMeta {
	static ɵfac = function MatListItemMeta_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatListItemMeta)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListItemMeta,
		selectors: [[
			"",
			"matListItemMeta",
			""
		]],
		hostAttrs: [
			1,
			"mat-mdc-list-item-meta",
			"mdc-list-item__end"
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListItemMeta, [{
		type: Directive,
		args: [{
			selector: "[matListItemMeta]",
			host: { "class": "mat-mdc-list-item-meta mdc-list-item__end" }
		}]
	}], null, null);
})();
var _MatListItemGraphicBase = class _MatListItemGraphicBase {
	_listOption = inject(LIST_OPTION, { optional: true });
	_isAlignedAtStart() {
		return !this._listOption || this._listOption?._getTogglePosition() === "after";
	}
	static ɵfac = function _MatListItemGraphicBase_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || _MatListItemGraphicBase)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: _MatListItemGraphicBase,
		hostVars: 4,
		hostBindings: function _MatListItemGraphicBase_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵclassProp("mdc-list-item__start", ctx._isAlignedAtStart())("mdc-list-item__end", !ctx._isAlignedAtStart());
		}
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(_MatListItemGraphicBase, [{
		type: Directive,
		args: [{ host: {
			"[class.mdc-list-item__start]": "_isAlignedAtStart()",
			"[class.mdc-list-item__end]": "!_isAlignedAtStart()"
		} }]
	}], null, null);
})();
var MatListItemAvatar = class MatListItemAvatar extends _MatListItemGraphicBase {
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMatListItemAvatar_BaseFactory;
		return function MatListItemAvatar_Factory(__ngFactoryType__) {
			return (ɵMatListItemAvatar_BaseFactory || (ɵMatListItemAvatar_BaseFactory = ɵɵgetInheritedFactory(MatListItemAvatar)))(__ngFactoryType__ || MatListItemAvatar);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListItemAvatar,
		selectors: [[
			"",
			"matListItemAvatar",
			""
		]],
		hostAttrs: [1, "mat-mdc-list-item-avatar"],
		features: [ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListItemAvatar, [{
		type: Directive,
		args: [{
			selector: "[matListItemAvatar]",
			host: { "class": "mat-mdc-list-item-avatar" }
		}]
	}], null, null);
})();
var MatListItemIcon = class MatListItemIcon extends _MatListItemGraphicBase {
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMatListItemIcon_BaseFactory;
		return function MatListItemIcon_Factory(__ngFactoryType__) {
			return (ɵMatListItemIcon_BaseFactory || (ɵMatListItemIcon_BaseFactory = ɵɵgetInheritedFactory(MatListItemIcon)))(__ngFactoryType__ || MatListItemIcon);
		};
	})();
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListItemIcon,
		selectors: [[
			"",
			"matListItemIcon",
			""
		]],
		hostAttrs: [1, "mat-mdc-list-item-icon"],
		features: [ɵɵInheritDefinitionFeature]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListItemIcon, [{
		type: Directive,
		args: [{
			selector: "[matListItemIcon]",
			host: { "class": "mat-mdc-list-item-icon" }
		}]
	}], null, null);
})();
var MAT_LIST_CONFIG = new InjectionToken("MAT_LIST_CONFIG");
var MatListBase = class MatListBase {
	_isNonInteractive = true;
	get disableRipple() {
		return this._disableRipple;
	}
	set disableRipple(value) {
		this._disableRipple = coerceBooleanProperty(value);
	}
	_disableRipple = false;
	get disabled() {
		return this._disabled();
	}
	set disabled(value) {
		this._disabled.set(coerceBooleanProperty(value));
	}
	_disabled = signal(false, ...ngDevMode ? [{ debugName: "_disabled" }] : []);
	_defaultOptions = inject(MAT_LIST_CONFIG, { optional: true });
	static ɵfac = function MatListBase_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatListBase)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListBase,
		hostVars: 1,
		hostBindings: function MatListBase_HostBindings(rf, ctx) {
			if (rf & 2) ɵɵattribute("aria-disabled", ctx.disabled);
		},
		inputs: {
			disableRipple: "disableRipple",
			disabled: "disabled"
		}
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListBase, [{
		type: Directive,
		args: [{ host: { "[attr.aria-disabled]": "disabled" } }]
	}], null, {
		disableRipple: [{ type: Input }],
		disabled: [{ type: Input }]
	});
})();
var MatListItemBase = class MatListItemBase {
	_elementRef = inject(ElementRef);
	_ngZone = inject(NgZone);
	_listBase = inject(MatListBase, { optional: true });
	_platform = inject(Platform);
	_hostElement;
	_isButtonElement;
	_noopAnimations = _animationsDisabled();
	_avatars;
	_icons;
	set lines(lines) {
		this._explicitLines = coerceNumberProperty(lines, null);
		this._updateItemLines(false);
	}
	_explicitLines = null;
	get disableRipple() {
		return this.disabled || this._disableRipple || this._noopAnimations || !!this._listBase?.disableRipple;
	}
	set disableRipple(value) {
		this._disableRipple = coerceBooleanProperty(value);
	}
	_disableRipple = false;
	get disabled() {
		return this._disabled() || !!this._listBase?.disabled;
	}
	set disabled(value) {
		this._disabled.set(coerceBooleanProperty(value));
	}
	_disabled = signal(false, ...ngDevMode ? [{ debugName: "_disabled" }] : []);
	_subscriptions = new Subscription();
	_rippleRenderer = null;
	_hasUnscopedTextContent = false;
	rippleConfig;
	get rippleDisabled() {
		return this.disableRipple || !!this.rippleConfig.disabled;
	}
	constructor() {
		inject(_CdkPrivateStyleLoader).load(_StructuralStylesLoader);
		const globalRippleOptions = inject(MAT_RIPPLE_GLOBAL_OPTIONS, { optional: true });
		this.rippleConfig = globalRippleOptions || {};
		this._hostElement = this._elementRef.nativeElement;
		this._isButtonElement = this._hostElement.nodeName.toLowerCase() === "button";
		if (this._listBase && !this._listBase._isNonInteractive) this._initInteractiveListItem();
		if (this._isButtonElement && !this._hostElement.hasAttribute("type")) this._hostElement.setAttribute("type", "button");
	}
	ngAfterViewInit() {
		this._monitorProjectedLinesAndTitle();
		this._updateItemLines(true);
	}
	ngOnDestroy() {
		this._subscriptions.unsubscribe();
		if (this._rippleRenderer !== null) this._rippleRenderer._removeTriggerEvents();
	}
	_hasIconOrAvatar() {
		return !!(this._avatars.length || this._icons.length);
	}
	_initInteractiveListItem() {
		this._hostElement.classList.add("mat-mdc-list-item-interactive");
		this._rippleRenderer = new RippleRenderer(this, this._ngZone, this._hostElement, this._platform, inject(Injector));
		this._rippleRenderer.setupTriggerEvents(this._hostElement);
	}
	_monitorProjectedLinesAndTitle() {
		this._ngZone.runOutsideAngular(() => {
			this._subscriptions.add(merge(this._lines.changes, this._titles.changes).subscribe(() => this._updateItemLines(false)));
		});
	}
	_updateItemLines(recheckUnscopedContent) {
		if (!this._lines || !this._titles || !this._unscopedContent) return;
		if (recheckUnscopedContent) this._checkDomForUnscopedTextContent();
		if (typeof ngDevMode === "undefined" || ngDevMode) sanityCheckListItemContent(this);
		const numberOfLines = this._explicitLines ?? this._inferLinesFromContent();
		const unscopedContentEl = this._unscopedContent.nativeElement;
		this._hostElement.classList.toggle("mat-mdc-list-item-single-line", numberOfLines <= 1);
		this._hostElement.classList.toggle("mdc-list-item--with-one-line", numberOfLines <= 1);
		this._hostElement.classList.toggle("mdc-list-item--with-two-lines", numberOfLines === 2);
		this._hostElement.classList.toggle("mdc-list-item--with-three-lines", numberOfLines === 3);
		if (this._hasUnscopedTextContent) {
			const treatAsTitle = this._titles.length === 0 && numberOfLines === 1;
			unscopedContentEl.classList.toggle("mdc-list-item__primary-text", treatAsTitle);
			unscopedContentEl.classList.toggle("mdc-list-item__secondary-text", !treatAsTitle);
		} else {
			unscopedContentEl.classList.remove("mdc-list-item__primary-text");
			unscopedContentEl.classList.remove("mdc-list-item__secondary-text");
		}
	}
	_inferLinesFromContent() {
		let numOfLines = this._titles.length + this._lines.length;
		if (this._hasUnscopedTextContent) numOfLines += 1;
		return numOfLines;
	}
	_checkDomForUnscopedTextContent() {
		this._hasUnscopedTextContent = Array.from(this._unscopedContent.nativeElement.childNodes).filter((node) => node.nodeType !== node.COMMENT_NODE).some((node) => !!(node.textContent && node.textContent.trim()));
	}
	static ɵfac = function MatListItemBase_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatListItemBase)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListItemBase,
		contentQueries: function MatListItemBase_ContentQueries(rf, ctx, dirIndex) {
			if (rf & 1) ɵɵcontentQuery(dirIndex, MatListItemAvatar, 4)(dirIndex, MatListItemIcon, 4);
			if (rf & 2) {
				let _t;
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._avatars = _t);
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._icons = _t);
			}
		},
		hostVars: 4,
		hostBindings: function MatListItemBase_HostBindings(rf, ctx) {
			if (rf & 2) {
				ɵɵattribute("aria-disabled", ctx.disabled)("disabled", ctx._isButtonElement && ctx.disabled || null);
				ɵɵclassProp("mdc-list-item--disabled", ctx.disabled);
			}
		},
		inputs: {
			lines: "lines",
			disableRipple: "disableRipple",
			disabled: "disabled"
		}
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListItemBase, [{
		type: Directive,
		args: [{ host: {
			"[class.mdc-list-item--disabled]": "disabled",
			"[attr.aria-disabled]": "disabled",
			"[attr.disabled]": "(_isButtonElement && disabled) || null"
		} }]
	}], () => [], {
		_avatars: [{
			type: ContentChildren,
			args: [MatListItemAvatar, { descendants: false }]
		}],
		_icons: [{
			type: ContentChildren,
			args: [MatListItemIcon, { descendants: false }]
		}],
		lines: [{ type: Input }],
		disableRipple: [{ type: Input }],
		disabled: [{ type: Input }]
	});
})();
function sanityCheckListItemContent(item) {
	const numTitles = item._titles.length;
	const numLines = item._lines.length;
	if (numTitles > 1) console.warn("A list item cannot have multiple titles.");
	if (numTitles === 0 && numLines > 0) console.warn("A list item line can only be used if there is a list item title.");
	if (numTitles === 0 && item._hasUnscopedTextContent && item._explicitLines !== null && item._explicitLines > 1) console.warn("A list item cannot have wrapping content without a title.");
	if (numLines > 2 || numLines === 2 && item._hasUnscopedTextContent) console.warn("A list item can have at maximum three lines.");
}
var MatActionList = class MatActionList extends MatListBase {
	_isNonInteractive = false;
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMatActionList_BaseFactory;
		return function MatActionList_Factory(__ngFactoryType__) {
			return (ɵMatActionList_BaseFactory || (ɵMatActionList_BaseFactory = ɵɵgetInheritedFactory(MatActionList)))(__ngFactoryType__ || MatActionList);
		};
	})();
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatActionList,
		selectors: [["mat-action-list"]],
		hostAttrs: [
			"role",
			"group",
			1,
			"mat-mdc-action-list",
			"mat-mdc-list-base",
			"mdc-list"
		],
		exportAs: ["matActionList"],
		features: [ɵɵProvidersFeature([{
			provide: MatListBase,
			useExisting: MatActionList
		}]), ɵɵInheritDefinitionFeature],
		ngContentSelectors: _c0,
		decls: 1,
		vars: 0,
		template: function MatActionList_Template(rf, ctx) {
			if (rf & 1) {
				ɵɵprojectionDef();
				ɵɵprojection(0);
			}
		},
		styles: [".mdc-list {\n  margin: 0;\n  padding: 8px 0;\n  list-style-type: none;\n}\n.mdc-list:focus {\n  outline: none;\n}\n\n.mdc-list-item {\n  display: flex;\n  position: relative;\n  justify-content: flex-start;\n  overflow: hidden;\n  padding: 0;\n  align-items: stretch;\n  cursor: pointer;\n  padding-left: 16px;\n  padding-right: 16px;\n  background-color: var(--%NS%mat-list-list-item-container-color, transparent);\n  border-radius: var(--%NS%mat-list-list-item-container-shape, var(--%NS%mat-sys-corner-none));\n}\n.mdc-list-item.mdc-list-item--selected {\n  background-color: var(--%NS%mat-list-list-item-selected-container-color);\n}\n.mdc-list-item:focus {\n  outline: 0;\n}\n.mdc-list-item.mdc-list-item--disabled {\n  cursor: auto;\n}\n.mdc-list-item.mdc-list-item--with-one-line {\n  height: var(--%NS%mat-list-list-item-one-line-container-height, 48px);\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__start {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-two-lines {\n  height: var(--%NS%mat-list-list-item-two-line-container-height, 64px);\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-three-lines {\n  height: var(--%NS%mat-list-list-item-three-line-container-height, 88px);\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--%NS%selected::before, .mdc-list-item.mdc-list-item--%NS%selected:focus::before, .mdc-list-item:not(.mdc-list-item--selected):focus::before {\n  position: absolute;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n  content: \"\";\n  pointer-events: none;\n}\n\na.mdc-list-item {\n  color: inherit;\n  text-decoration: none;\n}\n\n.mdc-list-item__start {\n  fill: currentColor;\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--%NS%mat-list-list-item-leading-icon-color, var(--%NS%mat-sys-on-surface-variant));\n  width: var(--%NS%mat-list-list-item-leading-icon-size, 24px);\n  height: var(--%NS%mat-list-list-item-leading-icon-size, 24px);\n  margin-left: 16px;\n  margin-right: 32px;\n}\n[dir=rtl] .mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-left: 32px;\n  margin-right: 16px;\n}\n.mdc-list-item--%NS%with-leading-icon:hover .mdc-list-item__start {\n  color: var(--%NS%mat-list-list-item-hover-leading-icon-color);\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  width: var(--%NS%mat-list-list-item-leading-avatar-size, 40px);\n  height: var(--%NS%mat-list-list-item-leading-avatar-size, 40px);\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start, [dir=rtl] .mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n\n.mdc-list-item__end {\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  font-family: var(--%NS%mat-list-list-item-trailing-supporting-text-font, var(--%NS%mat-sys-label-small-font));\n  line-height: var(--%NS%mat-list-list-item-trailing-supporting-text-line-height, var(--%NS%mat-sys-label-small-line-height));\n  font-size: var(--%NS%mat-list-list-item-trailing-supporting-text-size, var(--%NS%mat-sys-label-small-size));\n  font-weight: var(--%NS%mat-list-list-item-trailing-supporting-text-weight, var(--%NS%mat-sys-label-small-weight));\n  letter-spacing: var(--%NS%mat-list-list-item-trailing-supporting-text-tracking, var(--%NS%mat-sys-label-small-tracking));\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-trailing-icon-color, var(--%NS%mat-sys-on-surface-variant));\n  width: var(--%NS%mat-list-list-item-trailing-icon-size, 24px);\n  height: var(--%NS%mat-list-list-item-trailing-icon-size, 24px);\n}\n.mdc-list-item--%NS%with-trailing-icon:hover .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-hover-trailing-icon-color);\n}\n.mdc-list-item.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-trailing-supporting-text-color, var(--%NS%mat-sys-on-surface-variant));\n}\n.mdc-list-item--selected.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-selected-trailing-icon-color, var(--%NS%mat-sys-primary));\n}\n\n.mdc-list-item__content {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  align-self: center;\n  flex: 1;\n  pointer-events: none;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__content, .mdc-list-item--with-three-lines .mdc-list-item__content {\n  align-self: stretch;\n}\n\n.mdc-list-item__primary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  color: var(--%NS%mat-list-list-item-label-text-color, var(--%NS%mat-sys-on-surface));\n  font-family: var(--%NS%mat-list-list-item-label-text-font, var(--%NS%mat-sys-body-large-font));\n  line-height: var(--%NS%mat-list-list-item-label-text-line-height, var(--%NS%mat-sys-body-large-line-height));\n  font-size: var(--%NS%mat-list-list-item-label-text-size, var(--%NS%mat-sys-body-large-size));\n  font-weight: var(--%NS%mat-list-list-item-label-text-weight, var(--%NS%mat-sys-body-large-weight));\n  letter-spacing: var(--%NS%mat-list-list-item-label-text-tracking, var(--%NS%mat-sys-body-large-tracking));\n}\n.mdc-list-item:hover .mdc-list-item__primary-text {\n  color: var(--%NS%mat-list-list-item-hover-label-text-color, var(--%NS%mat-sys-on-surface));\n}\n.mdc-list-item:focus .mdc-list-item__primary-text {\n  color: var(--%NS%mat-list-list-item-focus-label-text-color, var(--%NS%mat-sys-on-surface));\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text, .mdc-list-item--with-three-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n\n.mdc-list-item__secondary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  display: block;\n  margin-top: 0;\n  color: var(--%NS%mat-list-list-item-supporting-text-color, var(--%NS%mat-sys-on-surface-variant));\n  font-family: var(--%NS%mat-list-list-item-supporting-text-font, var(--%NS%mat-sys-body-medium-font));\n  line-height: var(--%NS%mat-list-list-item-supporting-text-line-height, var(--%NS%mat-sys-body-medium-line-height));\n  font-size: var(--%NS%mat-list-list-item-supporting-text-size, var(--%NS%mat-sys-body-medium-size));\n  font-weight: var(--%NS%mat-list-list-item-supporting-text-weight, var(--%NS%mat-sys-body-medium-weight));\n  letter-spacing: var(--%NS%mat-list-list-item-supporting-text-tracking, var(--%NS%mat-sys-body-medium-tracking));\n}\n.mdc-list-item__secondary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-three-lines .mdc-list-item__secondary-text {\n  white-space: normal;\n  line-height: 20px;\n}\n.mdc-list-item--with-overline .mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: auto;\n}\n\n.mdc-list-item--with-leading-radio.mdc-list-item,\n.mdc-list-item--with-leading-checkbox.mdc-list-item,\n.mdc-list-item--with-leading-icon.mdc-list-item,\n.mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-checkbox.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-icon.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-trailing-icon.mdc-list-item, [dir=rtl] .mdc-list-item--with-trailing-icon.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n}\n\n.mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  -webkit-user-select: none;\n  user-select: none;\n  margin-left: 28px;\n  margin-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 28px;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end {\n  display: block;\n  line-height: normal;\n  align-self: flex-start;\n  margin-top: 0;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end::before, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-leading-radio .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio .mdc-list-item__start,\n[dir=rtl] .mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-item--with-trailing-radio.mdc-list-item,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-left: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, [dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-radio .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio .mdc-list-item__end,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-three-lines .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-group__subheader {\n  margin: 0.75rem 16px;\n}\n\n.mdc-list-item--disabled .mdc-list-item__start,\n.mdc-list-item--disabled .mdc-list-item__content,\n.mdc-list-item--disabled .mdc-list-item__end {\n  opacity: 1;\n}\n.mdc-list-item--disabled .mdc-list-item__primary-text,\n.mdc-list-item--disabled .mdc-list-item__secondary-text {\n  opacity: var(--%NS%mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n.mdc-list-item--disabled.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--%NS%mat-list-list-item-disabled-leading-icon-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-disabled-leading-icon-opacity, 0.38);\n}\n.mdc-list-item--disabled.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--%NS%mat-list-list-item-disabled-trailing-icon-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-disabled-trailing-icon-opacity, 0.38);\n}\n\n.mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing, [dir=rtl] .mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing {\n  padding-left: 0;\n  padding-right: 0;\n}\n\n.mdc-list-item.mdc-list-item--disabled .mdc-list-item__primary-text {\n  color: var(--%NS%mat-list-list-item-disabled-label-text-color, var(--%NS%mat-sys-on-surface));\n}\n\n.mdc-list-item:hover::before {\n  background-color: var(--%NS%mat-list-list-item-hover-state-layer-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));\n}\n\n.mdc-list-item.mdc-list-item--%NS%disabled::before {\n  background-color: var(--%NS%mat-list-list-item-disabled-state-layer-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-disabled-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item:focus::before {\n  background-color: var(--%NS%mat-list-list-item-focus-state-layer-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-list-list-item-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item--disabled .mdc-radio,\n.mdc-list-item--disabled .mdc-checkbox {\n  opacity: var(--%NS%mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n\n.mdc-list-item--with-leading-avatar .mat-mdc-list-item-avatar {\n  border-radius: var(--%NS%mat-list-list-item-leading-avatar-shape, var(--%NS%mat-sys-corner-full));\n  background-color: var(--%NS%mat-list-list-item-leading-avatar-color, var(--%NS%mat-sys-primary-container));\n}\n\n.mat-mdc-list-item-icon {\n  font-size: var(--%NS%mat-list-list-item-leading-icon-size, 24px);\n}\n\n@media (forced-colors: active) {\n  a.mdc-list-item--%NS%activated::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  a.mdc-list-item--activated [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n\n.mat-mdc-list-base {\n  display: block;\n}\n.mat-mdc-list-base .mdc-list-item__start,\n.mat-mdc-list-base .mdc-list-item__end,\n.mat-mdc-list-base .mdc-list-item__content {\n  pointer-events: auto;\n}\n\n.mat-mdc-list-item,\n.mat-mdc-list-option {\n  width: 100%;\n  box-sizing: border-box;\n  -webkit-tap-highlight-color: transparent;\n}\n.mat-mdc-list-item:not(.mat-mdc-list-item-interactive),\n.mat-mdc-list-option:not(.mat-mdc-list-item-interactive) {\n  cursor: default;\n}\n.mat-mdc-list-item .mat-divider-inset,\n.mat-mdc-list-option .mat-divider-inset {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n}\n.mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n.mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-left: 72px;\n}\n[dir=rtl] .mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n[dir=rtl] .mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-right: 72px;\n}\n\n.mat-mdc-list-item-interactive::before {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  content: \"\";\n  opacity: 0;\n  pointer-events: none;\n  border-radius: inherit;\n}\n\n.mat-mdc-list-item > .mat-focus-indicator {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  pointer-events: none;\n}\n.mat-mdc-list-item:focus-visible > .mat-focus-indicator::before {\n  content: \"\";\n}\n\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-line.mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: normal;\n}\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-unscoped-content.mdc-list-item__secondary-text {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n\nmat-action-list button {\n  background: none;\n  color: inherit;\n  border: none;\n  font: inherit;\n  outline: inherit;\n  -webkit-tap-highlight-color: transparent;\n  text-align: start;\n}\nmat-action-list button::-moz-focus-inner {\n  border: 0;\n}\n\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-inline-start: var(--%NS%mat-list-list-item-leading-icon-start-space, 16px);\n  margin-inline-end: var(--%NS%mat-list-list-item-leading-icon-end-space, 16px);\n}\n\n.mat-mdc-nav-list .mat-mdc-list-item {\n  border-radius: var(--%NS%mat-list-active-indicator-shape, var(--%NS%mat-sys-corner-full));\n  --%NS%mat-focus-indicator-border-radius: var(--%NS%mat-list-active-indicator-shape, var(--%NS%mat-sys-corner-full));\n}\n.mat-mdc-nav-list .mat-mdc-list-item.mdc-list-item--activated {\n  background-color: var(--%NS%mat-list-active-indicator-color, var(--%NS%mat-sys-secondary-container));\n}\n"],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatActionList, [{
		type: Component,
		args: [{
			selector: "mat-action-list",
			exportAs: "matActionList",
			template: "<ng-content></ng-content>",
			host: {
				"class": "mat-mdc-action-list mat-mdc-list-base mdc-list",
				"role": "group"
			},
			encapsulation: ViewEncapsulation.None,
			providers: [{
				provide: MatListBase,
				useExisting: MatActionList
			}],
			styles: [".mdc-list {\n  margin: 0;\n  padding: 8px 0;\n  list-style-type: none;\n}\n.mdc-list:focus {\n  outline: none;\n}\n\n.mdc-list-item {\n  display: flex;\n  position: relative;\n  justify-content: flex-start;\n  overflow: hidden;\n  padding: 0;\n  align-items: stretch;\n  cursor: pointer;\n  padding-left: 16px;\n  padding-right: 16px;\n  background-color: var(--mat-list-list-item-container-color, transparent);\n  border-radius: var(--mat-list-list-item-container-shape, var(--mat-sys-corner-none));\n}\n.mdc-list-item.mdc-list-item--selected {\n  background-color: var(--mat-list-list-item-selected-container-color);\n}\n.mdc-list-item:focus {\n  outline: 0;\n}\n.mdc-list-item.mdc-list-item--disabled {\n  cursor: auto;\n}\n.mdc-list-item.mdc-list-item--with-one-line {\n  height: var(--mat-list-list-item-one-line-container-height, 48px);\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__start {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-two-lines {\n  height: var(--mat-list-list-item-two-line-container-height, 64px);\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-three-lines {\n  height: var(--mat-list-list-item-three-line-container-height, 88px);\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--selected::before, .mdc-list-item.mdc-list-item--selected:focus::before, .mdc-list-item:not(.mdc-list-item--selected):focus::before {\n  position: absolute;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n  content: \"\";\n  pointer-events: none;\n}\n\na.mdc-list-item {\n  color: inherit;\n  text-decoration: none;\n}\n\n.mdc-list-item__start {\n  fill: currentColor;\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-leading-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-leading-icon-size, 24px);\n  height: var(--mat-list-list-item-leading-icon-size, 24px);\n  margin-left: 16px;\n  margin-right: 32px;\n}\n[dir=rtl] .mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-left: 32px;\n  margin-right: 16px;\n}\n.mdc-list-item--with-leading-icon:hover .mdc-list-item__start {\n  color: var(--mat-list-list-item-hover-leading-icon-color);\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  width: var(--mat-list-list-item-leading-avatar-size, 40px);\n  height: var(--mat-list-list-item-leading-avatar-size, 40px);\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start, [dir=rtl] .mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n\n.mdc-list-item__end {\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  font-family: var(--mat-list-list-item-trailing-supporting-text-font, var(--mat-sys-label-small-font));\n  line-height: var(--mat-list-list-item-trailing-supporting-text-line-height, var(--mat-sys-label-small-line-height));\n  font-size: var(--mat-list-list-item-trailing-supporting-text-size, var(--mat-sys-label-small-size));\n  font-weight: var(--mat-list-list-item-trailing-supporting-text-weight, var(--mat-sys-label-small-weight));\n  letter-spacing: var(--mat-list-list-item-trailing-supporting-text-tracking, var(--mat-sys-label-small-tracking));\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-trailing-icon-size, 24px);\n  height: var(--mat-list-list-item-trailing-icon-size, 24px);\n}\n.mdc-list-item--with-trailing-icon:hover .mdc-list-item__end {\n  color: var(--mat-list-list-item-hover-trailing-icon-color);\n}\n.mdc-list-item.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-supporting-text-color, var(--mat-sys-on-surface-variant));\n}\n.mdc-list-item--selected.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-selected-trailing-icon-color, var(--mat-sys-primary));\n}\n\n.mdc-list-item__content {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  align-self: center;\n  flex: 1;\n  pointer-events: none;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__content, .mdc-list-item--with-three-lines .mdc-list-item__content {\n  align-self: stretch;\n}\n\n.mdc-list-item__primary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  color: var(--mat-list-list-item-label-text-color, var(--mat-sys-on-surface));\n  font-family: var(--mat-list-list-item-label-text-font, var(--mat-sys-body-large-font));\n  line-height: var(--mat-list-list-item-label-text-line-height, var(--mat-sys-body-large-line-height));\n  font-size: var(--mat-list-list-item-label-text-size, var(--mat-sys-body-large-size));\n  font-weight: var(--mat-list-list-item-label-text-weight, var(--mat-sys-body-large-weight));\n  letter-spacing: var(--mat-list-list-item-label-text-tracking, var(--mat-sys-body-large-tracking));\n}\n.mdc-list-item:hover .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-hover-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item:focus .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-focus-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text, .mdc-list-item--with-three-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n\n.mdc-list-item__secondary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  display: block;\n  margin-top: 0;\n  color: var(--mat-list-list-item-supporting-text-color, var(--mat-sys-on-surface-variant));\n  font-family: var(--mat-list-list-item-supporting-text-font, var(--mat-sys-body-medium-font));\n  line-height: var(--mat-list-list-item-supporting-text-line-height, var(--mat-sys-body-medium-line-height));\n  font-size: var(--mat-list-list-item-supporting-text-size, var(--mat-sys-body-medium-size));\n  font-weight: var(--mat-list-list-item-supporting-text-weight, var(--mat-sys-body-medium-weight));\n  letter-spacing: var(--mat-list-list-item-supporting-text-tracking, var(--mat-sys-body-medium-tracking));\n}\n.mdc-list-item__secondary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-three-lines .mdc-list-item__secondary-text {\n  white-space: normal;\n  line-height: 20px;\n}\n.mdc-list-item--with-overline .mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: auto;\n}\n\n.mdc-list-item--with-leading-radio.mdc-list-item,\n.mdc-list-item--with-leading-checkbox.mdc-list-item,\n.mdc-list-item--with-leading-icon.mdc-list-item,\n.mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-checkbox.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-icon.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-trailing-icon.mdc-list-item, [dir=rtl] .mdc-list-item--with-trailing-icon.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n}\n\n.mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  -webkit-user-select: none;\n  user-select: none;\n  margin-left: 28px;\n  margin-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 28px;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end {\n  display: block;\n  line-height: normal;\n  align-self: flex-start;\n  margin-top: 0;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end::before, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-leading-radio .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio .mdc-list-item__start,\n[dir=rtl] .mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-item--with-trailing-radio.mdc-list-item,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-left: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, [dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-radio .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio .mdc-list-item__end,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-three-lines .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-group__subheader {\n  margin: 0.75rem 16px;\n}\n\n.mdc-list-item--disabled .mdc-list-item__start,\n.mdc-list-item--disabled .mdc-list-item__content,\n.mdc-list-item--disabled .mdc-list-item__end {\n  opacity: 1;\n}\n.mdc-list-item--disabled .mdc-list-item__primary-text,\n.mdc-list-item--disabled .mdc-list-item__secondary-text {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n.mdc-list-item--disabled.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-disabled-leading-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-leading-icon-opacity, 0.38);\n}\n.mdc-list-item--disabled.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-disabled-trailing-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-trailing-icon-opacity, 0.38);\n}\n\n.mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing, [dir=rtl] .mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing {\n  padding-left: 0;\n  padding-right: 0;\n}\n\n.mdc-list-item.mdc-list-item--disabled .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-disabled-label-text-color, var(--mat-sys-on-surface));\n}\n\n.mdc-list-item:hover::before {\n  background-color: var(--mat-list-list-item-hover-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));\n}\n\n.mdc-list-item.mdc-list-item--disabled::before {\n  background-color: var(--mat-list-list-item-disabled-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item:focus::before {\n  background-color: var(--mat-list-list-item-focus-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item--disabled .mdc-radio,\n.mdc-list-item--disabled .mdc-checkbox {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n\n.mdc-list-item--with-leading-avatar .mat-mdc-list-item-avatar {\n  border-radius: var(--mat-list-list-item-leading-avatar-shape, var(--mat-sys-corner-full));\n  background-color: var(--mat-list-list-item-leading-avatar-color, var(--mat-sys-primary-container));\n}\n\n.mat-mdc-list-item-icon {\n  font-size: var(--mat-list-list-item-leading-icon-size, 24px);\n}\n\n@media (forced-colors: active) {\n  a.mdc-list-item--activated::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  a.mdc-list-item--activated [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n\n.mat-mdc-list-base {\n  display: block;\n}\n.mat-mdc-list-base .mdc-list-item__start,\n.mat-mdc-list-base .mdc-list-item__end,\n.mat-mdc-list-base .mdc-list-item__content {\n  pointer-events: auto;\n}\n\n.mat-mdc-list-item,\n.mat-mdc-list-option {\n  width: 100%;\n  box-sizing: border-box;\n  -webkit-tap-highlight-color: transparent;\n}\n.mat-mdc-list-item:not(.mat-mdc-list-item-interactive),\n.mat-mdc-list-option:not(.mat-mdc-list-item-interactive) {\n  cursor: default;\n}\n.mat-mdc-list-item .mat-divider-inset,\n.mat-mdc-list-option .mat-divider-inset {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n}\n.mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n.mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-left: 72px;\n}\n[dir=rtl] .mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n[dir=rtl] .mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-right: 72px;\n}\n\n.mat-mdc-list-item-interactive::before {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  content: \"\";\n  opacity: 0;\n  pointer-events: none;\n  border-radius: inherit;\n}\n\n.mat-mdc-list-item > .mat-focus-indicator {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  pointer-events: none;\n}\n.mat-mdc-list-item:focus-visible > .mat-focus-indicator::before {\n  content: \"\";\n}\n\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-line.mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: normal;\n}\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-unscoped-content.mdc-list-item__secondary-text {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n\nmat-action-list button {\n  background: none;\n  color: inherit;\n  border: none;\n  font: inherit;\n  outline: inherit;\n  -webkit-tap-highlight-color: transparent;\n  text-align: start;\n}\nmat-action-list button::-moz-focus-inner {\n  border: 0;\n}\n\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-inline-start: var(--mat-list-list-item-leading-icon-start-space, 16px);\n  margin-inline-end: var(--mat-list-list-item-leading-icon-end-space, 16px);\n}\n\n.mat-mdc-nav-list .mat-mdc-list-item {\n  border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n  --mat-focus-indicator-border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n}\n.mat-mdc-nav-list .mat-mdc-list-item.mdc-list-item--activated {\n  background-color: var(--mat-list-active-indicator-color, var(--mat-sys-secondary-container));\n}\n"]
		}]
	}], null, null);
})();
var MAT_LIST = new InjectionToken("MatList");
var MatList = class MatList extends MatListBase {
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMatList_BaseFactory;
		return function MatList_Factory(__ngFactoryType__) {
			return (ɵMatList_BaseFactory || (ɵMatList_BaseFactory = ɵɵgetInheritedFactory(MatList)))(__ngFactoryType__ || MatList);
		};
	})();
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatList,
		selectors: [["mat-list"]],
		hostAttrs: [
			1,
			"mat-mdc-list",
			"mat-mdc-list-base",
			"mdc-list"
		],
		exportAs: ["matList"],
		features: [ɵɵProvidersFeature([{
			provide: MatListBase,
			useExisting: MatList
		}]), ɵɵInheritDefinitionFeature],
		ngContentSelectors: _c0,
		decls: 1,
		vars: 0,
		template: function MatList_Template(rf, ctx) {
			if (rf & 1) {
				ɵɵprojectionDef();
				ɵɵprojection(0);
			}
		},
		styles: [_c1],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatList, [{
		type: Component,
		args: [{
			selector: "mat-list",
			exportAs: "matList",
			template: "<ng-content></ng-content>",
			host: { "class": "mat-mdc-list mat-mdc-list-base mdc-list" },
			encapsulation: ViewEncapsulation.None,
			providers: [{
				provide: MatListBase,
				useExisting: MatList
			}],
			styles: [".mdc-list {\n  margin: 0;\n  padding: 8px 0;\n  list-style-type: none;\n}\n.mdc-list:focus {\n  outline: none;\n}\n\n.mdc-list-item {\n  display: flex;\n  position: relative;\n  justify-content: flex-start;\n  overflow: hidden;\n  padding: 0;\n  align-items: stretch;\n  cursor: pointer;\n  padding-left: 16px;\n  padding-right: 16px;\n  background-color: var(--mat-list-list-item-container-color, transparent);\n  border-radius: var(--mat-list-list-item-container-shape, var(--mat-sys-corner-none));\n}\n.mdc-list-item.mdc-list-item--selected {\n  background-color: var(--mat-list-list-item-selected-container-color);\n}\n.mdc-list-item:focus {\n  outline: 0;\n}\n.mdc-list-item.mdc-list-item--disabled {\n  cursor: auto;\n}\n.mdc-list-item.mdc-list-item--with-one-line {\n  height: var(--mat-list-list-item-one-line-container-height, 48px);\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__start {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-two-lines {\n  height: var(--mat-list-list-item-two-line-container-height, 64px);\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-three-lines {\n  height: var(--mat-list-list-item-three-line-container-height, 88px);\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--selected::before, .mdc-list-item.mdc-list-item--selected:focus::before, .mdc-list-item:not(.mdc-list-item--selected):focus::before {\n  position: absolute;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n  content: \"\";\n  pointer-events: none;\n}\n\na.mdc-list-item {\n  color: inherit;\n  text-decoration: none;\n}\n\n.mdc-list-item__start {\n  fill: currentColor;\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-leading-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-leading-icon-size, 24px);\n  height: var(--mat-list-list-item-leading-icon-size, 24px);\n  margin-left: 16px;\n  margin-right: 32px;\n}\n[dir=rtl] .mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-left: 32px;\n  margin-right: 16px;\n}\n.mdc-list-item--with-leading-icon:hover .mdc-list-item__start {\n  color: var(--mat-list-list-item-hover-leading-icon-color);\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  width: var(--mat-list-list-item-leading-avatar-size, 40px);\n  height: var(--mat-list-list-item-leading-avatar-size, 40px);\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start, [dir=rtl] .mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n\n.mdc-list-item__end {\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  font-family: var(--mat-list-list-item-trailing-supporting-text-font, var(--mat-sys-label-small-font));\n  line-height: var(--mat-list-list-item-trailing-supporting-text-line-height, var(--mat-sys-label-small-line-height));\n  font-size: var(--mat-list-list-item-trailing-supporting-text-size, var(--mat-sys-label-small-size));\n  font-weight: var(--mat-list-list-item-trailing-supporting-text-weight, var(--mat-sys-label-small-weight));\n  letter-spacing: var(--mat-list-list-item-trailing-supporting-text-tracking, var(--mat-sys-label-small-tracking));\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-trailing-icon-size, 24px);\n  height: var(--mat-list-list-item-trailing-icon-size, 24px);\n}\n.mdc-list-item--with-trailing-icon:hover .mdc-list-item__end {\n  color: var(--mat-list-list-item-hover-trailing-icon-color);\n}\n.mdc-list-item.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-supporting-text-color, var(--mat-sys-on-surface-variant));\n}\n.mdc-list-item--selected.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-selected-trailing-icon-color, var(--mat-sys-primary));\n}\n\n.mdc-list-item__content {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  align-self: center;\n  flex: 1;\n  pointer-events: none;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__content, .mdc-list-item--with-three-lines .mdc-list-item__content {\n  align-self: stretch;\n}\n\n.mdc-list-item__primary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  color: var(--mat-list-list-item-label-text-color, var(--mat-sys-on-surface));\n  font-family: var(--mat-list-list-item-label-text-font, var(--mat-sys-body-large-font));\n  line-height: var(--mat-list-list-item-label-text-line-height, var(--mat-sys-body-large-line-height));\n  font-size: var(--mat-list-list-item-label-text-size, var(--mat-sys-body-large-size));\n  font-weight: var(--mat-list-list-item-label-text-weight, var(--mat-sys-body-large-weight));\n  letter-spacing: var(--mat-list-list-item-label-text-tracking, var(--mat-sys-body-large-tracking));\n}\n.mdc-list-item:hover .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-hover-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item:focus .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-focus-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text, .mdc-list-item--with-three-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n\n.mdc-list-item__secondary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  display: block;\n  margin-top: 0;\n  color: var(--mat-list-list-item-supporting-text-color, var(--mat-sys-on-surface-variant));\n  font-family: var(--mat-list-list-item-supporting-text-font, var(--mat-sys-body-medium-font));\n  line-height: var(--mat-list-list-item-supporting-text-line-height, var(--mat-sys-body-medium-line-height));\n  font-size: var(--mat-list-list-item-supporting-text-size, var(--mat-sys-body-medium-size));\n  font-weight: var(--mat-list-list-item-supporting-text-weight, var(--mat-sys-body-medium-weight));\n  letter-spacing: var(--mat-list-list-item-supporting-text-tracking, var(--mat-sys-body-medium-tracking));\n}\n.mdc-list-item__secondary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-three-lines .mdc-list-item__secondary-text {\n  white-space: normal;\n  line-height: 20px;\n}\n.mdc-list-item--with-overline .mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: auto;\n}\n\n.mdc-list-item--with-leading-radio.mdc-list-item,\n.mdc-list-item--with-leading-checkbox.mdc-list-item,\n.mdc-list-item--with-leading-icon.mdc-list-item,\n.mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-checkbox.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-icon.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-trailing-icon.mdc-list-item, [dir=rtl] .mdc-list-item--with-trailing-icon.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n}\n\n.mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  -webkit-user-select: none;\n  user-select: none;\n  margin-left: 28px;\n  margin-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 28px;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end {\n  display: block;\n  line-height: normal;\n  align-self: flex-start;\n  margin-top: 0;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end::before, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-leading-radio .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio .mdc-list-item__start,\n[dir=rtl] .mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-item--with-trailing-radio.mdc-list-item,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-left: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, [dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-radio .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio .mdc-list-item__end,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-three-lines .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-group__subheader {\n  margin: 0.75rem 16px;\n}\n\n.mdc-list-item--disabled .mdc-list-item__start,\n.mdc-list-item--disabled .mdc-list-item__content,\n.mdc-list-item--disabled .mdc-list-item__end {\n  opacity: 1;\n}\n.mdc-list-item--disabled .mdc-list-item__primary-text,\n.mdc-list-item--disabled .mdc-list-item__secondary-text {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n.mdc-list-item--disabled.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-disabled-leading-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-leading-icon-opacity, 0.38);\n}\n.mdc-list-item--disabled.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-disabled-trailing-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-trailing-icon-opacity, 0.38);\n}\n\n.mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing, [dir=rtl] .mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing {\n  padding-left: 0;\n  padding-right: 0;\n}\n\n.mdc-list-item.mdc-list-item--disabled .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-disabled-label-text-color, var(--mat-sys-on-surface));\n}\n\n.mdc-list-item:hover::before {\n  background-color: var(--mat-list-list-item-hover-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));\n}\n\n.mdc-list-item.mdc-list-item--disabled::before {\n  background-color: var(--mat-list-list-item-disabled-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item:focus::before {\n  background-color: var(--mat-list-list-item-focus-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item--disabled .mdc-radio,\n.mdc-list-item--disabled .mdc-checkbox {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n\n.mdc-list-item--with-leading-avatar .mat-mdc-list-item-avatar {\n  border-radius: var(--mat-list-list-item-leading-avatar-shape, var(--mat-sys-corner-full));\n  background-color: var(--mat-list-list-item-leading-avatar-color, var(--mat-sys-primary-container));\n}\n\n.mat-mdc-list-item-icon {\n  font-size: var(--mat-list-list-item-leading-icon-size, 24px);\n}\n\n@media (forced-colors: active) {\n  a.mdc-list-item--activated::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  a.mdc-list-item--activated [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n\n.mat-mdc-list-base {\n  display: block;\n}\n.mat-mdc-list-base .mdc-list-item__start,\n.mat-mdc-list-base .mdc-list-item__end,\n.mat-mdc-list-base .mdc-list-item__content {\n  pointer-events: auto;\n}\n\n.mat-mdc-list-item,\n.mat-mdc-list-option {\n  width: 100%;\n  box-sizing: border-box;\n  -webkit-tap-highlight-color: transparent;\n}\n.mat-mdc-list-item:not(.mat-mdc-list-item-interactive),\n.mat-mdc-list-option:not(.mat-mdc-list-item-interactive) {\n  cursor: default;\n}\n.mat-mdc-list-item .mat-divider-inset,\n.mat-mdc-list-option .mat-divider-inset {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n}\n.mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n.mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-left: 72px;\n}\n[dir=rtl] .mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n[dir=rtl] .mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-right: 72px;\n}\n\n.mat-mdc-list-item-interactive::before {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  content: \"\";\n  opacity: 0;\n  pointer-events: none;\n  border-radius: inherit;\n}\n\n.mat-mdc-list-item > .mat-focus-indicator {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  pointer-events: none;\n}\n.mat-mdc-list-item:focus-visible > .mat-focus-indicator::before {\n  content: \"\";\n}\n\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-line.mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: normal;\n}\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-unscoped-content.mdc-list-item__secondary-text {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n\nmat-action-list button {\n  background: none;\n  color: inherit;\n  border: none;\n  font: inherit;\n  outline: inherit;\n  -webkit-tap-highlight-color: transparent;\n  text-align: start;\n}\nmat-action-list button::-moz-focus-inner {\n  border: 0;\n}\n\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-inline-start: var(--mat-list-list-item-leading-icon-start-space, 16px);\n  margin-inline-end: var(--mat-list-list-item-leading-icon-end-space, 16px);\n}\n\n.mat-mdc-nav-list .mat-mdc-list-item {\n  border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n  --mat-focus-indicator-border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n}\n.mat-mdc-nav-list .mat-mdc-list-item.mdc-list-item--activated {\n  background-color: var(--mat-list-active-indicator-color, var(--mat-sys-secondary-container));\n}\n"]
		}]
	}], null, null);
})();
var MatListItem = class MatListItem extends MatListItemBase {
	_lines;
	_titles;
	_meta;
	_unscopedContent;
	_itemText;
	get activated() {
		return this._activated;
	}
	set activated(activated) {
		this._activated = coerceBooleanProperty(activated);
	}
	_activated = false;
	_getAriaCurrent() {
		return this._hostElement.nodeName === "A" && this._activated ? "page" : null;
	}
	_hasBothLeadingAndTrailing() {
		return this._meta.length !== 0 && (this._avatars.length !== 0 || this._icons.length !== 0);
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMatListItem_BaseFactory;
		return function MatListItem_Factory(__ngFactoryType__) {
			return (ɵMatListItem_BaseFactory || (ɵMatListItem_BaseFactory = ɵɵgetInheritedFactory(MatListItem)))(__ngFactoryType__ || MatListItem);
		};
	})();
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatListItem,
		selectors: [
			["mat-list-item"],
			[
				"a",
				"mat-list-item",
				""
			],
			[
				"button",
				"mat-list-item",
				""
			]
		],
		contentQueries: function MatListItem_ContentQueries(rf, ctx, dirIndex) {
			if (rf & 1) ɵɵcontentQuery(dirIndex, MatListItemLine, 5)(dirIndex, MatListItemTitle, 5)(dirIndex, MatListItemMeta, 5);
			if (rf & 2) {
				let _t;
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._lines = _t);
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._titles = _t);
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._meta = _t);
			}
		},
		viewQuery: function MatListItem_Query(rf, ctx) {
			if (rf & 1) ɵɵviewQuery(_c2, 5)(_c3, 5);
			if (rf & 2) {
				let _t;
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._unscopedContent = _t.first);
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._itemText = _t.first);
			}
		},
		hostAttrs: [
			1,
			"mat-mdc-list-item",
			"mdc-list-item"
		],
		hostVars: 13,
		hostBindings: function MatListItem_HostBindings(rf, ctx) {
			if (rf & 2) {
				ɵɵattribute("aria-current", ctx._getAriaCurrent());
				ɵɵclassProp("mdc-list-item--activated", ctx.activated)("mdc-list-item--with-leading-avatar", ctx._avatars.length !== 0)("mdc-list-item--with-leading-icon", ctx._icons.length !== 0)("mdc-list-item--with-trailing-meta", ctx._meta.length !== 0)("mat-mdc-list-item-both-leading-and-trailing", ctx._hasBothLeadingAndTrailing())("_mat-animation-noopable", ctx._noopAnimations);
			}
		},
		inputs: { activated: "activated" },
		exportAs: ["matListItem"],
		features: [ɵɵInheritDefinitionFeature],
		ngContentSelectors: _c5,
		decls: 10,
		vars: 0,
		consts: [
			["unscopedContent", ""],
			[1, "mdc-list-item__content"],
			[
				1,
				"mat-mdc-list-item-unscoped-content",
				3,
				"cdkObserveContent"
			],
			[1, "mat-focus-indicator"]
		],
		template: function MatListItem_Template(rf, ctx) {
			if (rf & 1) {
				ɵɵprojectionDef(_c4);
				ɵɵprojection(0);
				ɵɵelementStart(1, "span", 1);
				ɵɵprojection(2, 1);
				ɵɵprojection(3, 2);
				ɵɵelementStart(4, "span", 2, 0);
				ɵɵlistener("cdkObserveContent", function MatListItem_Template_span_cdkObserveContent_4_listener() {
					return ctx._updateItemLines(true);
				});
				ɵɵprojection(6, 3);
				ɵɵelementEnd()();
				ɵɵprojection(7, 4);
				ɵɵprojection(8, 5);
				ɵɵelement(9, "div", 3);
			}
		},
		dependencies: [CdkObserveContent],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListItem, [{
		type: Component,
		args: [{
			selector: "mat-list-item, a[mat-list-item], button[mat-list-item]",
			exportAs: "matListItem",
			host: {
				"class": "mat-mdc-list-item mdc-list-item",
				"[class.mdc-list-item--activated]": "activated",
				"[class.mdc-list-item--with-leading-avatar]": "_avatars.length !== 0",
				"[class.mdc-list-item--with-leading-icon]": "_icons.length !== 0",
				"[class.mdc-list-item--with-trailing-meta]": "_meta.length !== 0",
				"[class.mat-mdc-list-item-both-leading-and-trailing]": "_hasBothLeadingAndTrailing()",
				"[class._mat-animation-noopable]": "_noopAnimations",
				"[attr.aria-current]": "_getAriaCurrent()"
			},
			encapsulation: ViewEncapsulation.None,
			imports: [CdkObserveContent],
			template: "<ng-content select=\"[matListItemAvatar],[matListItemIcon]\"></ng-content>\n\n<span class=\"mdc-list-item__content\">\n  <ng-content select=\"[matListItemTitle]\"></ng-content>\n  <ng-content select=\"[matListItemLine]\"></ng-content>\n  <span #unscopedContent class=\"mat-mdc-list-item-unscoped-content\"\n        (cdkObserveContent)=\"_updateItemLines(true)\">\n    <ng-content></ng-content>\n  </span>\n</span>\n\n<ng-content select=\"[matListItemMeta]\"></ng-content>\n\n<ng-content select=\"mat-divider\"></ng-content>\n\n<!--\n  Strong focus indicator element. MDC uses the `::before` pseudo element for the default\n  focus/hover/selected state, so we need a separate element.\n-->\n<div class=\"mat-focus-indicator\"></div>\n"
		}]
	}], null, {
		_lines: [{
			type: ContentChildren,
			args: [MatListItemLine, { descendants: true }]
		}],
		_titles: [{
			type: ContentChildren,
			args: [MatListItemTitle, { descendants: true }]
		}],
		_meta: [{
			type: ContentChildren,
			args: [MatListItemMeta, { descendants: true }]
		}],
		_unscopedContent: [{
			type: ViewChild,
			args: ["unscopedContent"]
		}],
		_itemText: [{
			type: ViewChild,
			args: ["text"]
		}],
		activated: [{ type: Input }]
	});
})();
var SELECTION_LIST = new InjectionToken("SelectionList");
var MatListOption = class MatListOption extends MatListItemBase {
	_selectionList = inject(SELECTION_LIST);
	_changeDetectorRef = inject(ChangeDetectorRef);
	_lines;
	_titles;
	_unscopedContent;
	selectedChange = new EventEmitter();
	togglePosition = "after";
	get color() {
		return this._color || this._selectionList.color;
	}
	set color(newValue) {
		this._color = newValue;
	}
	_color;
	get value() {
		return this._value;
	}
	set value(newValue) {
		if (this.selected && newValue !== this.value && this._inputsInitialized) this.selected = false;
		this._value = newValue;
	}
	_value;
	get selected() {
		return this._selectionList.selectedOptions.isSelected(this);
	}
	set selected(value) {
		const isSelected = coerceBooleanProperty(value);
		if (isSelected !== this._selected) {
			this._setSelected(isSelected);
			if (isSelected || this._selectionList.multiple) this._selectionList._reportValueChange();
		}
	}
	_selected = false;
	_inputsInitialized = false;
	ngOnInit() {
		const list = this._selectionList;
		if (list._value && list._value.some((value) => list.compareWith(this._value, value))) this._setSelected(true);
		const wasSelected = this._selected;
		Promise.resolve().then(() => {
			if (this._selected || wasSelected) {
				this.selected = true;
				this._changeDetectorRef.markForCheck();
			}
		});
		this._inputsInitialized = true;
	}
	ngOnDestroy() {
		super.ngOnDestroy();
		if (this.selected) Promise.resolve().then(() => {
			this.selected = false;
		});
	}
	toggle() {
		this.selected = !this.selected;
	}
	focus() {
		this._hostElement.focus();
	}
	getLabel() {
		return (this._titles?.get(0)?._elementRef.nativeElement || this._unscopedContent?.nativeElement)?.textContent || "";
	}
	_hasCheckboxAt(position) {
		return this._selectionList.multiple && this._getTogglePosition() === position;
	}
	_hasRadioAt(position) {
		return !this._selectionList.multiple && this._getTogglePosition() === position && !this._selectionList.hideSingleSelectionIndicator;
	}
	_hasIconsOrAvatarsAt(position) {
		return this._hasProjected("icons", position) || this._hasProjected("avatars", position);
	}
	_hasProjected(type, position) {
		return this._getTogglePosition() !== position && (type === "avatars" ? this._avatars.length !== 0 : this._icons.length !== 0);
	}
	_handleBlur() {
		this._selectionList._onTouched();
	}
	_getTogglePosition() {
		return this.togglePosition || "after";
	}
	_setSelected(selected) {
		if (selected === this._selected) return false;
		this._selected = selected;
		if (selected) this._selectionList.selectedOptions.select(this);
		else this._selectionList.selectedOptions.deselect(this);
		this.selectedChange.emit(selected);
		this._changeDetectorRef.markForCheck();
		return true;
	}
	_markForCheck() {
		this._changeDetectorRef.markForCheck();
	}
	_toggleOnInteraction() {
		if (!this.disabled) {
			if (this._selectionList.multiple) {
				this.selected = !this.selected;
				this._selectionList._emitChangeEvent([this]);
			} else if (!this.selected) {
				this.selected = true;
				this._selectionList._emitChangeEvent([this]);
			}
		}
	}
	_setTabindex(value) {
		this._hostElement.setAttribute("tabindex", value + "");
	}
	_hasBothLeadingAndTrailing() {
		const hasLeading = this._hasProjected("avatars", "before") || this._hasProjected("icons", "before") || this._hasCheckboxAt("before") || this._hasRadioAt("before");
		const hasTrailing = this._hasProjected("icons", "after") || this._hasProjected("avatars", "after") || this._hasCheckboxAt("after") || this._hasRadioAt("after");
		return hasLeading && hasTrailing;
	}
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMatListOption_BaseFactory;
		return function MatListOption_Factory(__ngFactoryType__) {
			return (ɵMatListOption_BaseFactory || (ɵMatListOption_BaseFactory = ɵɵgetInheritedFactory(MatListOption)))(__ngFactoryType__ || MatListOption);
		};
	})();
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatListOption,
		selectors: [["mat-list-option"]],
		contentQueries: function MatListOption_ContentQueries(rf, ctx, dirIndex) {
			if (rf & 1) ɵɵcontentQuery(dirIndex, MatListItemLine, 5)(dirIndex, MatListItemTitle, 5);
			if (rf & 2) {
				let _t;
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._lines = _t);
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._titles = _t);
			}
		},
		viewQuery: function MatListOption_Query(rf, ctx) {
			if (rf & 1) ɵɵviewQuery(_c2, 5);
			if (rf & 2) {
				let _t;
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._unscopedContent = _t.first);
			}
		},
		hostAttrs: [
			"role",
			"option",
			1,
			"mat-mdc-list-item",
			"mat-mdc-list-option",
			"mdc-list-item"
		],
		hostVars: 27,
		hostBindings: function MatListOption_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("blur", function MatListOption_blur_HostBindingHandler() {
				return ctx._handleBlur();
			})("click", function MatListOption_click_HostBindingHandler() {
				return ctx._toggleOnInteraction();
			});
			if (rf & 2) {
				ɵɵattribute("aria-selected", ctx.selected);
				ɵɵclassProp("mdc-list-item--selected", ctx.selected && !ctx._selectionList.multiple && ctx._selectionList.hideSingleSelectionIndicator)("mdc-list-item--with-leading-avatar", ctx._hasProjected("avatars", "before"))("mdc-list-item--with-leading-icon", ctx._hasProjected("icons", "before"))("mdc-list-item--with-trailing-icon", ctx._hasProjected("icons", "after"))("mat-mdc-list-option-with-trailing-avatar", ctx._hasProjected("avatars", "after"))("mdc-list-item--with-leading-checkbox", ctx._hasCheckboxAt("before"))("mdc-list-item--with-trailing-checkbox", ctx._hasCheckboxAt("after"))("mdc-list-item--with-leading-radio", ctx._hasRadioAt("before"))("mdc-list-item--with-trailing-radio", ctx._hasRadioAt("after"))("mat-mdc-list-item-both-leading-and-trailing", ctx._hasBothLeadingAndTrailing())("mat-accent", ctx.color !== "primary" && ctx.color !== "warn")("mat-warn", ctx.color === "warn")("_mat-animation-noopable", ctx._noopAnimations);
			}
		},
		inputs: {
			togglePosition: "togglePosition",
			color: "color",
			value: "value",
			selected: "selected"
		},
		outputs: { selectedChange: "selectedChange" },
		exportAs: ["matListOption"],
		features: [ɵɵProvidersFeature([{
			provide: MatListItemBase,
			useExisting: MatListOption
		}, {
			provide: LIST_OPTION,
			useExisting: MatListOption
		}]), ɵɵInheritDefinitionFeature],
		ngContentSelectors: _c7,
		decls: 20,
		vars: 4,
		consts: [
			["icons", ""],
			["checkbox", ""],
			["radio", ""],
			["unscopedContent", ""],
			[
				1,
				"mdc-list-item__start",
				"mat-mdc-list-option-checkbox-before"
			],
			[
				1,
				"mdc-list-item__start",
				"mat-mdc-list-option-radio-before"
			],
			[3, "ngTemplateOutlet"],
			[1, "mdc-list-item__content"],
			[
				1,
				"mat-mdc-list-item-unscoped-content",
				3,
				"cdkObserveContent"
			],
			[1, "mdc-list-item__end"],
			[1, "mat-focus-indicator"],
			[1, "mdc-checkbox"],
			[
				"type",
				"checkbox",
				1,
				"mdc-checkbox__native-control",
				3,
				"checked",
				"disabled"
			],
			[1, "mdc-checkbox__background"],
			[
				"viewBox",
				"0 0 24 24",
				"aria-hidden",
				"true",
				1,
				"mdc-checkbox__checkmark"
			],
			[
				"fill",
				"none",
				"d",
				"M1.73,12.91 8.1,19.28 22.79,4.59",
				1,
				"mdc-checkbox__checkmark-path"
			],
			[1, "mdc-checkbox__mixedmark"],
			[1, "mdc-radio"],
			[
				"type",
				"radio",
				1,
				"mdc-radio__native-control",
				3,
				"checked",
				"disabled"
			],
			[1, "mdc-radio__background"],
			[1, "mdc-radio__outer-circle"],
			[1, "mdc-radio__inner-circle"]
		],
		template: function MatListOption_Template(rf, ctx) {
			if (rf & 1) {
				ɵɵprojectionDef(_c6);
				ɵɵtemplate(0, MatListOption_ng_template_0_Template, 1, 0, "ng-template", null, 0, ɵɵtemplateRefExtractor)(2, MatListOption_ng_template_2_Template, 6, 4, "ng-template", null, 1, ɵɵtemplateRefExtractor)(4, MatListOption_ng_template_4_Template, 5, 4, "ng-template", null, 2, ɵɵtemplateRefExtractor);
				ɵɵconditionalCreate(6, MatListOption_Conditional_6_Template, 2, 1, "span", 4)(7, MatListOption_Conditional_7_Template, 2, 1, "span", 5);
				ɵɵconditionalCreate(8, MatListOption_Conditional_8_Template, 1, 1, null, 6);
				ɵɵelementStart(9, "span", 7);
				ɵɵprojection(10);
				ɵɵprojection(11, 1);
				ɵɵelementStart(12, "span", 8, 3);
				ɵɵlistener("cdkObserveContent", function MatListOption_Template_span_cdkObserveContent_12_listener() {
					return ctx._updateItemLines(true);
				});
				ɵɵprojection(14, 2);
				ɵɵelementEnd()();
				ɵɵconditionalCreate(15, MatListOption_Conditional_15_Template, 2, 1, "span", 9)(16, MatListOption_Conditional_16_Template, 2, 1, "span", 9);
				ɵɵconditionalCreate(17, MatListOption_Conditional_17_Template, 1, 1, null, 6);
				ɵɵprojection(18, 3);
				ɵɵelement(19, "div", 10);
			}
			if (rf & 2) {
				ɵɵadvance(6);
				ɵɵconditional(ctx._hasCheckboxAt("before") ? 6 : ctx._hasRadioAt("before") ? 7 : -1);
				ɵɵadvance(2);
				ɵɵconditional(ctx._hasIconsOrAvatarsAt("before") ? 8 : -1);
				ɵɵadvance(7);
				ɵɵconditional(ctx._hasCheckboxAt("after") ? 15 : ctx._hasRadioAt("after") ? 16 : -1);
				ɵɵadvance(2);
				ɵɵconditional(ctx._hasIconsOrAvatarsAt("after") ? 17 : -1);
			}
		},
		dependencies: [NgTemplateOutlet, CdkObserveContent],
		styles: [".mat-mdc-list-option-with-trailing-avatar.mdc-list-item, [dir=rtl] .mat-mdc-list-option-with-trailing-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mat-mdc-list-option-with-trailing-avatar .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n  width: 40px;\n  height: 40px;\n}\n.mat-mdc-list-option-with-trailing-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mat-mdc-list-option-with-trailing-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mat-mdc-list-option-with-trailing-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mat-mdc-list-option-with-trailing-avatar .mdc-list-item__end {\n  border-radius: 50%;\n}\n\n.mat-mdc-list-option .mdc-checkbox {\n  display: inline-block;\n  position: relative;\n  flex: 0 0 18px;\n  box-sizing: content-box;\n  width: 18px;\n  height: 18px;\n  line-height: 0;\n  white-space: nowrap;\n  cursor: pointer;\n  vertical-align: bottom;\n  padding: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - 18px) / 2);\n  margin: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);\n}\n.mat-mdc-list-option .mdc-checkbox .mdc-checkbox__native-control {\n  position: absolute;\n  margin: 0;\n  padding: 0;\n  opacity: 0;\n  cursor: inherit;\n  z-index: 1;\n  width: var(--%NS%mat-checkbox-state-layer-size, 40px);\n  height: var(--%NS%mat-checkbox-state-layer-size, 40px);\n  top: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);\n  right: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);\n  left: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);\n}\n.mat-mdc-list-option .mdc-checkbox--disabled {\n  cursor: default;\n  pointer-events: none;\n}\n.mat-mdc-list-option .mdc-checkbox__background {\n  display: inline-flex;\n  position: absolute;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  width: 18px;\n  height: 18px;\n  border: 2px solid currentColor;\n  border-radius: 2px;\n  background-color: transparent;\n  pointer-events: none;\n  will-change: background-color, border-color;\n  transition: background-color 90ms cubic-bezier(0.4, 0, 0.6, 1), border-color 90ms cubic-bezier(0.4, 0, 0.6, 1);\n  -webkit-print-color-adjust: exact;\n  color-adjust: exact;\n  border-color: var(--%NS%mat-checkbox-unselected-icon-color, var(--%NS%mat-sys-on-surface-variant));\n  top: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - 18px) / 2);\n  left: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - 18px) / 2);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:enabled:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:enabled:indeterminate ~ .mdc-checkbox__background {\n  border-color: var(--%NS%mat-checkbox-selected-icon-color, var(--%NS%mat-sys-primary));\n  background-color: var(--%NS%mat-checkbox-selected-icon-color, var(--%NS%mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__background {\n  border-color: var(--%NS%mat-checkbox-disabled-unselected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__background {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:disabled:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:disabled:indeterminate ~ .mdc-checkbox__background {\n  background-color: var(--%NS%mat-checkbox-disabled-selected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));\n  border-color: transparent;\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox__native-control:disabled:checked ~ .mdc-checkbox__background,\n  .mat-mdc-list-option .mdc-checkbox__native-control:disabled:indeterminate ~ .mdc-checkbox__background {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:not(:checked) ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:not(:indeterminate) ~ .mdc-checkbox__background {\n  border-color: var(--%NS%mat-checkbox-unselected-hover-icon-color, var(--%NS%mat-sys-on-surface));\n  background-color: transparent;\n}\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {\n  border-color: var(--%NS%mat-checkbox-selected-hover-icon-color, var(--%NS%mat-sys-primary));\n  background-color: var(--%NS%mat-checkbox-selected-hover-icon-color, var(--%NS%mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:not(:checked) ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:not(:indeterminate) ~ .mdc-checkbox__background {\n  border-color: var(--%NS%mat-checkbox-unselected-focus-icon-color, var(--%NS%mat-sys-on-surface));\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:indeterminate ~ .mdc-checkbox__background {\n  border-color: var(--%NS%mat-checkbox-selected-focus-icon-color, var(--%NS%mat-sys-primary));\n  background-color: var(--%NS%mat-checkbox-selected-focus-icon-color, var(--%NS%mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox:hover > .mdc-checkbox__native-control ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control:focus ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__background {\n  border-color: var(--%NS%mat-checkbox-disabled-unselected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox:hover > .mdc-checkbox__native-control ~ .mdc-checkbox__background,\n  .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control:focus ~ .mdc-checkbox__background,\n  .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__background {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {\n  background-color: var(--%NS%mat-checkbox-disabled-selected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));\n  border-color: transparent;\n}\n.mat-mdc-list-option .mdc-checkbox__checkmark {\n  position: absolute;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n  width: 100%;\n  opacity: 0;\n  transition: opacity 180ms cubic-bezier(0.4, 0, 0.6, 1);\n  color: var(--%NS%mat-checkbox-selected-checkmark-color, var(--%NS%mat-sys-on-primary));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox__checkmark {\n    color: CanvasText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__checkmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__checkmark {\n  color: var(--%NS%mat-checkbox-disabled-selected-checkmark-color, var(--%NS%mat-sys-surface));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__checkmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__checkmark {\n    color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox__checkmark-path {\n  transition: stroke-dashoffset 180ms cubic-bezier(0.4, 0, 0.6, 1);\n  stroke: currentColor;\n  stroke-width: 3.12px;\n  stroke-dashoffset: 29.7833385;\n  stroke-dasharray: 29.7833385;\n}\n.mat-mdc-list-option .mdc-checkbox__mixedmark {\n  width: 100%;\n  height: 0;\n  transform: scaleX(0) rotate(0deg);\n  border-width: 1px;\n  border-style: solid;\n  opacity: 0;\n  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);\n  border-color: var(--%NS%mat-checkbox-selected-checkmark-color, var(--%NS%mat-sys-on-primary));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox__mixedmark {\n    margin: 0 1px;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__mixedmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__mixedmark {\n  border-color: var(--%NS%mat-checkbox-disabled-selected-checkmark-color, var(--%NS%mat-sys-surface));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__mixedmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__mixedmark {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-checked .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--anim-checked-unchecked .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__background {\n  animation-duration: 180ms;\n  animation-timing-function: linear;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-checked .mdc-checkbox__checkmark-path {\n  animation: mdc-checkbox-unchecked-checked-checkmark-path 180ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-unchecked-indeterminate-mixedmark 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-checked-unchecked .mdc-checkbox__checkmark-path {\n  animation: mdc-checkbox-checked-unchecked-checkmark-path 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__checkmark {\n  animation: mdc-checkbox-checked-indeterminate-checkmark 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-checked-indeterminate-mixedmark 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__checkmark {\n  animation: mdc-checkbox-indeterminate-checked-checkmark 500ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-indeterminate-checked-mixedmark 500ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-indeterminate-unchecked-mixedmark 300ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {\n  transition: border-color 90ms cubic-bezier(0, 0, 0.2, 1), background-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path {\n  stroke-dashoffset: 0;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__checkmark {\n  transition: opacity 180ms cubic-bezier(0, 0, 0.2, 1), transform 180ms cubic-bezier(0, 0, 0.2, 1);\n  opacity: 1;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__mixedmark {\n  transform: scaleX(1) rotate(-45deg);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__checkmark {\n  transform: rotate(45deg);\n  opacity: 0;\n  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__mixedmark {\n  transform: scaleX(1) rotate(0deg);\n  opacity: 1;\n}\n@keyframes mdc-checkbox-unchecked-checked-checkmark-path {\n  0%, 50% {\n    stroke-dashoffset: 29.7833385;\n  }\n  50% {\n    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);\n  }\n  100% {\n    stroke-dashoffset: 0;\n  }\n}\n@keyframes mdc-checkbox-unchecked-indeterminate-mixedmark {\n  0%, 68.2% {\n    transform: scaleX(0);\n  }\n  68.2% {\n    animation-timing-function: cubic-bezier(0, 0, 0, 1);\n  }\n  100% {\n    transform: scaleX(1);\n  }\n}\n@keyframes mdc-checkbox-checked-unchecked-checkmark-path {\n  from {\n    animation-timing-function: cubic-bezier(0.4, 0, 1, 1);\n    opacity: 1;\n    stroke-dashoffset: 0;\n  }\n  to {\n    opacity: 0;\n    stroke-dashoffset: -29.7833385;\n  }\n}\n@keyframes mdc-checkbox-checked-indeterminate-checkmark {\n  from {\n    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);\n    transform: rotate(0deg);\n    opacity: 1;\n  }\n  to {\n    transform: rotate(45deg);\n    opacity: 0;\n  }\n}\n@keyframes mdc-checkbox-indeterminate-checked-checkmark {\n  from {\n    animation-timing-function: cubic-bezier(0.14, 0, 0, 1);\n    transform: rotate(45deg);\n    opacity: 0;\n  }\n  to {\n    transform: rotate(360deg);\n    opacity: 1;\n  }\n}\n@keyframes mdc-checkbox-checked-indeterminate-mixedmark {\n  from {\n    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);\n    transform: rotate(-45deg);\n    opacity: 0;\n  }\n  to {\n    transform: rotate(0deg);\n    opacity: 1;\n  }\n}\n@keyframes mdc-checkbox-indeterminate-checked-mixedmark {\n  from {\n    animation-timing-function: cubic-bezier(0.14, 0, 0, 1);\n    transform: rotate(0deg);\n    opacity: 1;\n  }\n  to {\n    transform: rotate(315deg);\n    opacity: 0;\n  }\n}\n@keyframes mdc-checkbox-indeterminate-unchecked-mixedmark {\n  0% {\n    animation-timing-function: linear;\n    transform: scaleX(1);\n    opacity: 1;\n  }\n  32.8%, 100% {\n    transform: scaleX(0);\n    opacity: 0;\n  }\n}\n.mat-mdc-list-option .mdc-radio {\n  display: inline-block;\n  position: relative;\n  flex: 0 0 auto;\n  box-sizing: content-box;\n  width: 20px;\n  height: 20px;\n  will-change: opacity, transform, border-color, color;\n  padding: calc((var(--%NS%mat-radio-state-layer-size, 40px) - 20px) / 2);\n}\n.mat-mdc-list-option .mdc-radio__background {\n  display: inline-block;\n  position: relative;\n  box-sizing: border-box;\n  width: 20px;\n  height: 20px;\n}\n.mat-mdc-list-option .mdc-radio__background::before {\n  position: absolute;\n  transform: scale(0, 0);\n  border-radius: 50%;\n  opacity: 0;\n  pointer-events: none;\n  content: \"\";\n  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);\n  width: var(--%NS%mat-radio-state-layer-size, 40px);\n  height: var(--%NS%mat-radio-state-layer-size, 40px);\n  top: calc(-1 * (var(--%NS%mat-radio-state-layer-size, 40px) - 20px) / 2);\n  left: calc(-1 * (var(--%NS%mat-radio-state-layer-size, 40px) - 20px) / 2);\n}\n.mat-mdc-list-option .mdc-radio__outer-circle {\n  position: absolute;\n  top: 0;\n  left: 0;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  border-width: 2px;\n  border-style: solid;\n  border-radius: 50%;\n  transition: border-color 90ms cubic-bezier(0.4, 0, 0.6, 1);\n}\n.mat-mdc-list-option .mdc-radio__inner-circle {\n  position: absolute;\n  top: 0;\n  left: 0;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  transform: scale(0);\n  border-radius: 50%;\n  transition: transform 90ms cubic-bezier(0.4, 0, 0.6, 1), background-color 90ms cubic-bezier(0.4, 0, 0.6, 1);\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-radio__inner-circle {\n    background-color: CanvasText !important;\n  }\n}\n.mat-mdc-list-option .mdc-radio__native-control {\n  position: absolute;\n  margin: 0;\n  padding: 0;\n  opacity: 0;\n  top: 0;\n  right: 0;\n  left: 0;\n  cursor: inherit;\n  z-index: 1;\n  width: var(--%NS%mat-radio-state-layer-size, 40px);\n  height: var(--%NS%mat-radio-state-layer-size, 40px);\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background, .mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background {\n  transition: opacity 90ms cubic-bezier(0, 0, 0.2, 1), transform 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background > .mdc-radio__outer-circle, .mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__outer-circle {\n  transition: border-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background > .mdc-radio__inner-circle, .mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__inner-circle {\n  transition: transform 90ms cubic-bezier(0, 0, 0.2, 1), background-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled:not(:checked) + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--%NS%mat-radio-disabled-unselected-icon-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-radio-disabled-unselected-icon-opacity, 0.38);\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background {\n  cursor: default;\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--%NS%mat-radio-disabled-selected-icon-color, var(--%NS%mat-sys-on-surface));\n  opacity: var(--%NS%mat-radio-disabled-selected-icon-opacity, 0.38);\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__inner-circle {\n  background-color: var(--%NS%mat-radio-disabled-selected-icon-color, var(--%NS%mat-sys-on-surface, currentColor));\n  opacity: var(--%NS%mat-radio-disabled-selected-icon-opacity, 0.38);\n}\n.mat-mdc-list-option .mdc-radio__native-control:enabled:not(:checked) + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--%NS%mat-radio-unselected-icon-color, var(--%NS%mat-sys-on-surface-variant));\n}\n.mat-mdc-list-option .mdc-radio__native-control:enabled:checked + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--%NS%mat-radio-selected-icon-color, var(--%NS%mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-radio__native-control:enabled:checked + .mdc-radio__background > .mdc-radio__inner-circle {\n  background-color: var(--%NS%mat-radio-selected-icon-color, var(--%NS%mat-sys-primary, currentColor));\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background > .mdc-radio__inner-circle {\n  transform: scale(0.5);\n  transition: transform 90ms cubic-bezier(0, 0, 0.2, 1), background-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option._mat-animation-noopable .mdc-radio__background::before,\n.mat-mdc-list-option._mat-animation-noopable .mdc-radio__outer-circle,\n.mat-mdc-list-option._mat-animation-noopable .mdc-radio__inner-circle {\n  transition: none !important;\n}\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mat-mdc-checkbox-touch-target,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__native-control,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__ripple,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mat-mdc-checkbox-ripple::before,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__mixedmark, .mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mat-mdc-checkbox-touch-target,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__native-control,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__ripple,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mat-mdc-checkbox-ripple::before,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__mixedmark {\n  transition: none !important;\n  animation: none !important;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control, .mat-mdc-list-option .mdc-radio__native-control {\n  display: none;\n}\n\n@media (forced-colors: active) {\n  .mat-mdc-list-option.mdc-list-item--%NS%selected::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  .mat-mdc-list-option.mdc-list-item--selected [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n"],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListOption, [{
		type: Component,
		args: [{
			selector: "mat-list-option",
			exportAs: "matListOption",
			host: {
				"class": "mat-mdc-list-item mat-mdc-list-option mdc-list-item",
				"role": "option",
				"[class.mdc-list-item--selected]": "selected && !_selectionList.multiple && _selectionList.hideSingleSelectionIndicator",
				"[class.mdc-list-item--with-leading-avatar]": "_hasProjected(\"avatars\", \"before\")",
				"[class.mdc-list-item--with-leading-icon]": "_hasProjected(\"icons\", \"before\")",
				"[class.mdc-list-item--with-trailing-icon]": "_hasProjected(\"icons\", \"after\")",
				"[class.mat-mdc-list-option-with-trailing-avatar]": "_hasProjected(\"avatars\", \"after\")",
				"[class.mdc-list-item--with-leading-checkbox]": "_hasCheckboxAt(\"before\")",
				"[class.mdc-list-item--with-trailing-checkbox]": "_hasCheckboxAt(\"after\")",
				"[class.mdc-list-item--with-leading-radio]": "_hasRadioAt(\"before\")",
				"[class.mdc-list-item--with-trailing-radio]": "_hasRadioAt(\"after\")",
				"[class.mat-mdc-list-item-both-leading-and-trailing]": "_hasBothLeadingAndTrailing()",
				"[class.mat-accent]": "color !== \"primary\" && color !== \"warn\"",
				"[class.mat-warn]": "color === \"warn\"",
				"[class._mat-animation-noopable]": "_noopAnimations",
				"[attr.aria-selected]": "selected",
				"(blur)": "_handleBlur()",
				"(click)": "_toggleOnInteraction()"
			},
			encapsulation: ViewEncapsulation.None,
			providers: [{
				provide: MatListItemBase,
				useExisting: MatListOption
			}, {
				provide: LIST_OPTION,
				useExisting: MatListOption
			}],
			imports: [NgTemplateOutlet, CdkObserveContent],
			template: "<!--\n  Save icons and the pseudo checkbox/radio so that they can be re-used in the template without\n  duplication. Also content can only be injected once so we need to extract icons/avatars\n  into a template since we use it in multiple places.\n-->\n<ng-template #icons>\n  <ng-content select=\"[matListItemAvatar],[matListItemIcon]\">\n  </ng-content>\n</ng-template>\n\n<ng-template #checkbox>\n  <div class=\"mdc-checkbox\" [class.mdc-checkbox--disabled]=\"disabled\">\n    <input type=\"checkbox\" class=\"mdc-checkbox__native-control\"\n           [checked]=\"selected\" [disabled]=\"disabled\"/>\n    <div class=\"mdc-checkbox__background\">\n      <svg class=\"mdc-checkbox__checkmark\"\n           viewBox=\"0 0 24 24\"\n           aria-hidden=\"true\">\n        <path class=\"mdc-checkbox__checkmark-path\"\n              fill=\"none\"\n              d=\"M1.73,12.91 8.1,19.28 22.79,4.59\"/>\n      </svg>\n      <div class=\"mdc-checkbox__mixedmark\"></div>\n    </div>\n  </div>\n</ng-template>\n\n<ng-template #radio>\n  <div class=\"mdc-radio\" [class.mdc-radio--disabled]=\"disabled\">\n    <input type=\"radio\" class=\"mdc-radio__native-control\"\n           [checked]=\"selected\" [disabled]=\"disabled\"/>\n    <div class=\"mdc-radio__background\">\n      <div class=\"mdc-radio__outer-circle\"></div>\n      <div class=\"mdc-radio__inner-circle\"></div>\n    </div>\n  </div>\n</ng-template>\n\n@if (_hasCheckboxAt('before')) {\n  <!-- Container for the checkbox at start. -->\n  <span class=\"mdc-list-item__start mat-mdc-list-option-checkbox-before\">\n    <ng-template [ngTemplateOutlet]=\"checkbox\"></ng-template>\n  </span>\n} @else if (_hasRadioAt('before')) {\n  <!-- Container for the radio at the start. -->\n  <span class=\"mdc-list-item__start mat-mdc-list-option-radio-before\">\n    <ng-template [ngTemplateOutlet]=\"radio\"></ng-template>\n  </span>\n}\n<!-- Conditionally renders icons/avatars before the list item text. -->\n@if (_hasIconsOrAvatarsAt('before')) {\n  <ng-template [ngTemplateOutlet]=\"icons\"></ng-template>\n}\n\n<!-- Text -->\n<span class=\"mdc-list-item__content\">\n  <ng-content select=\"[matListItemTitle]\"></ng-content>\n  <ng-content select=\"[matListItemLine]\"></ng-content>\n  <span #unscopedContent class=\"mat-mdc-list-item-unscoped-content\"\n        (cdkObserveContent)=\"_updateItemLines(true)\">\n    <ng-content></ng-content>\n  </span>\n</span>\n\n@if (_hasCheckboxAt('after')) {\n  <!-- Container for the checkbox at the end. -->\n  <span class=\"mdc-list-item__end\">\n    <ng-template [ngTemplateOutlet]=\"checkbox\"></ng-template>\n  </span>\n} @else if (_hasRadioAt('after')) {\n  <!-- Container for the radio at the end. -->\n  <span class=\"mdc-list-item__end\">\n    <ng-template [ngTemplateOutlet]=\"radio\"></ng-template>\n  </span>\n}\n\n<!-- Conditionally renders icons/avatars after the list item text. -->\n@if (_hasIconsOrAvatarsAt('after')) {\n  <ng-template [ngTemplateOutlet]=\"icons\"></ng-template>\n}\n\n<!-- Divider -->\n<ng-content select=\"mat-divider\"></ng-content>\n\n<!--\n  Strong focus indicator element. MDC uses the `::before` pseudo element for the default\n  focus/hover/selected state, so we need a separate element.\n-->\n<div class=\"mat-focus-indicator\"></div>\n",
			styles: [".mat-mdc-list-option-with-trailing-avatar.mdc-list-item, [dir=rtl] .mat-mdc-list-option-with-trailing-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mat-mdc-list-option-with-trailing-avatar .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n  width: 40px;\n  height: 40px;\n}\n.mat-mdc-list-option-with-trailing-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mat-mdc-list-option-with-trailing-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mat-mdc-list-option-with-trailing-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mat-mdc-list-option-with-trailing-avatar .mdc-list-item__end {\n  border-radius: 50%;\n}\n\n.mat-mdc-list-option .mdc-checkbox {\n  display: inline-block;\n  position: relative;\n  flex: 0 0 18px;\n  box-sizing: content-box;\n  width: 18px;\n  height: 18px;\n  line-height: 0;\n  white-space: nowrap;\n  cursor: pointer;\n  vertical-align: bottom;\n  padding: calc((var(--mat-checkbox-state-layer-size, 40px) - 18px) / 2);\n  margin: calc((var(--mat-checkbox-state-layer-size, 40px) - var(--mat-checkbox-state-layer-size, 40px)) / 2);\n}\n.mat-mdc-list-option .mdc-checkbox .mdc-checkbox__native-control {\n  position: absolute;\n  margin: 0;\n  padding: 0;\n  opacity: 0;\n  cursor: inherit;\n  z-index: 1;\n  width: var(--mat-checkbox-state-layer-size, 40px);\n  height: var(--mat-checkbox-state-layer-size, 40px);\n  top: calc((var(--mat-checkbox-state-layer-size, 40px) - var(--mat-checkbox-state-layer-size, 40px)) / 2);\n  right: calc((var(--mat-checkbox-state-layer-size, 40px) - var(--mat-checkbox-state-layer-size, 40px)) / 2);\n  left: calc((var(--mat-checkbox-state-layer-size, 40px) - var(--mat-checkbox-state-layer-size, 40px)) / 2);\n}\n.mat-mdc-list-option .mdc-checkbox--disabled {\n  cursor: default;\n  pointer-events: none;\n}\n.mat-mdc-list-option .mdc-checkbox__background {\n  display: inline-flex;\n  position: absolute;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  width: 18px;\n  height: 18px;\n  border: 2px solid currentColor;\n  border-radius: 2px;\n  background-color: transparent;\n  pointer-events: none;\n  will-change: background-color, border-color;\n  transition: background-color 90ms cubic-bezier(0.4, 0, 0.6, 1), border-color 90ms cubic-bezier(0.4, 0, 0.6, 1);\n  -webkit-print-color-adjust: exact;\n  color-adjust: exact;\n  border-color: var(--mat-checkbox-unselected-icon-color, var(--mat-sys-on-surface-variant));\n  top: calc((var(--mat-checkbox-state-layer-size, 40px) - 18px) / 2);\n  left: calc((var(--mat-checkbox-state-layer-size, 40px) - 18px) / 2);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:enabled:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:enabled:indeterminate ~ .mdc-checkbox__background {\n  border-color: var(--mat-checkbox-selected-icon-color, var(--mat-sys-primary));\n  background-color: var(--mat-checkbox-selected-icon-color, var(--mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__background {\n  border-color: var(--mat-checkbox-disabled-unselected-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__background {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:disabled:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:disabled:indeterminate ~ .mdc-checkbox__background {\n  background-color: var(--mat-checkbox-disabled-selected-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));\n  border-color: transparent;\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox__native-control:disabled:checked ~ .mdc-checkbox__background,\n  .mat-mdc-list-option .mdc-checkbox__native-control:disabled:indeterminate ~ .mdc-checkbox__background {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:not(:checked) ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:not(:indeterminate) ~ .mdc-checkbox__background {\n  border-color: var(--mat-checkbox-unselected-hover-icon-color, var(--mat-sys-on-surface));\n  background-color: transparent;\n}\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox:hover > .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {\n  border-color: var(--mat-checkbox-selected-hover-icon-color, var(--mat-sys-primary));\n  background-color: var(--mat-checkbox-selected-hover-icon-color, var(--mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:not(:checked) ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:not(:indeterminate) ~ .mdc-checkbox__background {\n  border-color: var(--mat-checkbox-unselected-focus-icon-color, var(--mat-sys-on-surface));\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:focus:focus:indeterminate ~ .mdc-checkbox__background {\n  border-color: var(--mat-checkbox-selected-focus-icon-color, var(--mat-sys-primary));\n  background-color: var(--mat-checkbox-selected-focus-icon-color, var(--mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox:hover > .mdc-checkbox__native-control ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control:focus ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__background {\n  border-color: var(--mat-checkbox-disabled-unselected-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox:hover > .mdc-checkbox__native-control ~ .mdc-checkbox__background,\n  .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control:focus ~ .mdc-checkbox__background,\n  .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__background {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {\n  background-color: var(--mat-checkbox-disabled-selected-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));\n  border-color: transparent;\n}\n.mat-mdc-list-option .mdc-checkbox__checkmark {\n  position: absolute;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n  width: 100%;\n  opacity: 0;\n  transition: opacity 180ms cubic-bezier(0.4, 0, 0.6, 1);\n  color: var(--mat-checkbox-selected-checkmark-color, var(--mat-sys-on-primary));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox__checkmark {\n    color: CanvasText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__checkmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__checkmark {\n  color: var(--mat-checkbox-disabled-selected-checkmark-color, var(--mat-sys-surface));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__checkmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__checkmark {\n    color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox__checkmark-path {\n  transition: stroke-dashoffset 180ms cubic-bezier(0.4, 0, 0.6, 1);\n  stroke: currentColor;\n  stroke-width: 3.12px;\n  stroke-dashoffset: 29.7833385;\n  stroke-dasharray: 29.7833385;\n}\n.mat-mdc-list-option .mdc-checkbox__mixedmark {\n  width: 100%;\n  height: 0;\n  transform: scaleX(0) rotate(0deg);\n  border-width: 1px;\n  border-style: solid;\n  opacity: 0;\n  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);\n  border-color: var(--mat-checkbox-selected-checkmark-color, var(--mat-sys-on-primary));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox__mixedmark {\n    margin: 0 1px;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__mixedmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__mixedmark {\n  border-color: var(--mat-checkbox-disabled-selected-checkmark-color, var(--mat-sys-surface));\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-checkbox--disabled .mdc-checkbox__mixedmark, .mat-mdc-list-option .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__mixedmark {\n    border-color: GrayText;\n  }\n}\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-checked .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--anim-checked-unchecked .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__background {\n  animation-duration: 180ms;\n  animation-timing-function: linear;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-checked .mdc-checkbox__checkmark-path {\n  animation: mdc-checkbox-unchecked-checked-checkmark-path 180ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-unchecked-indeterminate-mixedmark 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-checked-unchecked .mdc-checkbox__checkmark-path {\n  animation: mdc-checkbox-checked-unchecked-checkmark-path 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__checkmark {\n  animation: mdc-checkbox-checked-indeterminate-checkmark 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-checked-indeterminate-mixedmark 90ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__checkmark {\n  animation: mdc-checkbox-indeterminate-checked-checkmark 500ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-indeterminate-checked-mixedmark 500ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__mixedmark {\n  animation: mdc-checkbox-indeterminate-unchecked-mixedmark 300ms linear;\n  transition: none;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {\n  transition: border-color 90ms cubic-bezier(0, 0, 0.2, 1), background-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path {\n  stroke-dashoffset: 0;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__checkmark {\n  transition: opacity 180ms cubic-bezier(0, 0, 0.2, 1), transform 180ms cubic-bezier(0, 0, 0.2, 1);\n  opacity: 1;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__mixedmark {\n  transform: scaleX(1) rotate(-45deg);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__checkmark {\n  transform: rotate(45deg);\n  opacity: 0;\n  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);\n}\n.mat-mdc-list-option .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__mixedmark {\n  transform: scaleX(1) rotate(0deg);\n  opacity: 1;\n}\n@keyframes mdc-checkbox-unchecked-checked-checkmark-path {\n  0%, 50% {\n    stroke-dashoffset: 29.7833385;\n  }\n  50% {\n    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);\n  }\n  100% {\n    stroke-dashoffset: 0;\n  }\n}\n@keyframes mdc-checkbox-unchecked-indeterminate-mixedmark {\n  0%, 68.2% {\n    transform: scaleX(0);\n  }\n  68.2% {\n    animation-timing-function: cubic-bezier(0, 0, 0, 1);\n  }\n  100% {\n    transform: scaleX(1);\n  }\n}\n@keyframes mdc-checkbox-checked-unchecked-checkmark-path {\n  from {\n    animation-timing-function: cubic-bezier(0.4, 0, 1, 1);\n    opacity: 1;\n    stroke-dashoffset: 0;\n  }\n  to {\n    opacity: 0;\n    stroke-dashoffset: -29.7833385;\n  }\n}\n@keyframes mdc-checkbox-checked-indeterminate-checkmark {\n  from {\n    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);\n    transform: rotate(0deg);\n    opacity: 1;\n  }\n  to {\n    transform: rotate(45deg);\n    opacity: 0;\n  }\n}\n@keyframes mdc-checkbox-indeterminate-checked-checkmark {\n  from {\n    animation-timing-function: cubic-bezier(0.14, 0, 0, 1);\n    transform: rotate(45deg);\n    opacity: 0;\n  }\n  to {\n    transform: rotate(360deg);\n    opacity: 1;\n  }\n}\n@keyframes mdc-checkbox-checked-indeterminate-mixedmark {\n  from {\n    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);\n    transform: rotate(-45deg);\n    opacity: 0;\n  }\n  to {\n    transform: rotate(0deg);\n    opacity: 1;\n  }\n}\n@keyframes mdc-checkbox-indeterminate-checked-mixedmark {\n  from {\n    animation-timing-function: cubic-bezier(0.14, 0, 0, 1);\n    transform: rotate(0deg);\n    opacity: 1;\n  }\n  to {\n    transform: rotate(315deg);\n    opacity: 0;\n  }\n}\n@keyframes mdc-checkbox-indeterminate-unchecked-mixedmark {\n  0% {\n    animation-timing-function: linear;\n    transform: scaleX(1);\n    opacity: 1;\n  }\n  32.8%, 100% {\n    transform: scaleX(0);\n    opacity: 0;\n  }\n}\n.mat-mdc-list-option .mdc-radio {\n  display: inline-block;\n  position: relative;\n  flex: 0 0 auto;\n  box-sizing: content-box;\n  width: 20px;\n  height: 20px;\n  will-change: opacity, transform, border-color, color;\n  padding: calc((var(--mat-radio-state-layer-size, 40px) - 20px) / 2);\n}\n.mat-mdc-list-option .mdc-radio__background {\n  display: inline-block;\n  position: relative;\n  box-sizing: border-box;\n  width: 20px;\n  height: 20px;\n}\n.mat-mdc-list-option .mdc-radio__background::before {\n  position: absolute;\n  transform: scale(0, 0);\n  border-radius: 50%;\n  opacity: 0;\n  pointer-events: none;\n  content: \"\";\n  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);\n  width: var(--mat-radio-state-layer-size, 40px);\n  height: var(--mat-radio-state-layer-size, 40px);\n  top: calc(-1 * (var(--mat-radio-state-layer-size, 40px) - 20px) / 2);\n  left: calc(-1 * (var(--mat-radio-state-layer-size, 40px) - 20px) / 2);\n}\n.mat-mdc-list-option .mdc-radio__outer-circle {\n  position: absolute;\n  top: 0;\n  left: 0;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  border-width: 2px;\n  border-style: solid;\n  border-radius: 50%;\n  transition: border-color 90ms cubic-bezier(0.4, 0, 0.6, 1);\n}\n.mat-mdc-list-option .mdc-radio__inner-circle {\n  position: absolute;\n  top: 0;\n  left: 0;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  transform: scale(0);\n  border-radius: 50%;\n  transition: transform 90ms cubic-bezier(0.4, 0, 0.6, 1), background-color 90ms cubic-bezier(0.4, 0, 0.6, 1);\n}\n@media (forced-colors: active) {\n  .mat-mdc-list-option .mdc-radio__inner-circle {\n    background-color: CanvasText !important;\n  }\n}\n.mat-mdc-list-option .mdc-radio__native-control {\n  position: absolute;\n  margin: 0;\n  padding: 0;\n  opacity: 0;\n  top: 0;\n  right: 0;\n  left: 0;\n  cursor: inherit;\n  z-index: 1;\n  width: var(--mat-radio-state-layer-size, 40px);\n  height: var(--mat-radio-state-layer-size, 40px);\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background, .mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background {\n  transition: opacity 90ms cubic-bezier(0, 0, 0.2, 1), transform 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background > .mdc-radio__outer-circle, .mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__outer-circle {\n  transition: border-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background > .mdc-radio__inner-circle, .mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__inner-circle {\n  transition: transform 90ms cubic-bezier(0, 0, 0.2, 1), background-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled:not(:checked) + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--mat-radio-disabled-unselected-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-radio-disabled-unselected-icon-opacity, 0.38);\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background {\n  cursor: default;\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--mat-radio-disabled-selected-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-radio-disabled-selected-icon-opacity, 0.38);\n}\n.mat-mdc-list-option .mdc-radio__native-control:disabled + .mdc-radio__background > .mdc-radio__inner-circle {\n  background-color: var(--mat-radio-disabled-selected-icon-color, var(--mat-sys-on-surface, currentColor));\n  opacity: var(--mat-radio-disabled-selected-icon-opacity, 0.38);\n}\n.mat-mdc-list-option .mdc-radio__native-control:enabled:not(:checked) + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--mat-radio-unselected-icon-color, var(--mat-sys-on-surface-variant));\n}\n.mat-mdc-list-option .mdc-radio__native-control:enabled:checked + .mdc-radio__background > .mdc-radio__outer-circle {\n  border-color: var(--mat-radio-selected-icon-color, var(--mat-sys-primary));\n}\n.mat-mdc-list-option .mdc-radio__native-control:enabled:checked + .mdc-radio__background > .mdc-radio__inner-circle {\n  background-color: var(--mat-radio-selected-icon-color, var(--mat-sys-primary, currentColor));\n}\n.mat-mdc-list-option .mdc-radio__native-control:checked + .mdc-radio__background > .mdc-radio__inner-circle {\n  transform: scale(0.5);\n  transition: transform 90ms cubic-bezier(0, 0, 0.2, 1), background-color 90ms cubic-bezier(0, 0, 0.2, 1);\n}\n.mat-mdc-list-option._mat-animation-noopable .mdc-radio__background::before,\n.mat-mdc-list-option._mat-animation-noopable .mdc-radio__outer-circle,\n.mat-mdc-list-option._mat-animation-noopable .mdc-radio__inner-circle {\n  transition: none !important;\n}\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mat-mdc-checkbox-touch-target,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__native-control,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__ripple,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mat-mdc-checkbox-ripple::before,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__start > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__mixedmark, .mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mat-mdc-checkbox-touch-target,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__native-control,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__ripple,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mat-mdc-checkbox-ripple::before,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,\n.mat-mdc-list-option._mat-animation-noopable > .mdc-list-item__end > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__mixedmark {\n  transition: none !important;\n  animation: none !important;\n}\n.mat-mdc-list-option .mdc-checkbox__native-control, .mat-mdc-list-option .mdc-radio__native-control {\n  display: none;\n}\n\n@media (forced-colors: active) {\n  .mat-mdc-list-option.mdc-list-item--selected::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  .mat-mdc-list-option.mdc-list-item--selected [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n"]
		}]
	}], null, {
		_lines: [{
			type: ContentChildren,
			args: [MatListItemLine, { descendants: true }]
		}],
		_titles: [{
			type: ContentChildren,
			args: [MatListItemTitle, { descendants: true }]
		}],
		_unscopedContent: [{
			type: ViewChild,
			args: ["unscopedContent"]
		}],
		selectedChange: [{ type: Output }],
		togglePosition: [{ type: Input }],
		color: [{ type: Input }],
		value: [{ type: Input }],
		selected: [{ type: Input }]
	});
})();
var MatListSubheaderCssMatStyler = class MatListSubheaderCssMatStyler {
	static ɵfac = function MatListSubheaderCssMatStyler_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatListSubheaderCssMatStyler)();
	};
	static ɵdir = /* @__PURE__ */ ɵɵdefineDirective({
		type: MatListSubheaderCssMatStyler,
		selectors: [[
			"",
			"mat-subheader",
			""
		], [
			"",
			"matSubheader",
			""
		]],
		hostAttrs: [
			1,
			"mat-mdc-subheader",
			"mdc-list-group__subheader"
		]
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListSubheaderCssMatStyler, [{
		type: Directive,
		args: [{
			selector: "[mat-subheader], [matSubheader]",
			host: { "class": "mat-mdc-subheader mdc-list-group__subheader" }
		}]
	}], null, null);
})();
var MAT_NAV_LIST = new InjectionToken("MatNavList");
var MatNavList = class MatNavList extends MatListBase {
	_isNonInteractive = false;
	static ɵfac = /* @__PURE__ */ (() => {
		let ɵMatNavList_BaseFactory;
		return function MatNavList_Factory(__ngFactoryType__) {
			return (ɵMatNavList_BaseFactory || (ɵMatNavList_BaseFactory = ɵɵgetInheritedFactory(MatNavList)))(__ngFactoryType__ || MatNavList);
		};
	})();
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatNavList,
		selectors: [["mat-nav-list"]],
		hostAttrs: [
			"role",
			"navigation",
			1,
			"mat-mdc-nav-list",
			"mat-mdc-list-base",
			"mdc-list"
		],
		exportAs: ["matNavList"],
		features: [ɵɵProvidersFeature([{
			provide: MatListBase,
			useExisting: MatNavList
		}]), ɵɵInheritDefinitionFeature],
		ngContentSelectors: _c0,
		decls: 1,
		vars: 0,
		template: function MatNavList_Template(rf, ctx) {
			if (rf & 1) {
				ɵɵprojectionDef();
				ɵɵprojection(0);
			}
		},
		styles: [_c1],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatNavList, [{
		type: Component,
		args: [{
			selector: "mat-nav-list",
			exportAs: "matNavList",
			template: "<ng-content></ng-content>",
			host: {
				"class": "mat-mdc-nav-list mat-mdc-list-base mdc-list",
				"role": "navigation"
			},
			encapsulation: ViewEncapsulation.None,
			providers: [{
				provide: MatListBase,
				useExisting: MatNavList
			}],
			styles: [".mdc-list {\n  margin: 0;\n  padding: 8px 0;\n  list-style-type: none;\n}\n.mdc-list:focus {\n  outline: none;\n}\n\n.mdc-list-item {\n  display: flex;\n  position: relative;\n  justify-content: flex-start;\n  overflow: hidden;\n  padding: 0;\n  align-items: stretch;\n  cursor: pointer;\n  padding-left: 16px;\n  padding-right: 16px;\n  background-color: var(--mat-list-list-item-container-color, transparent);\n  border-radius: var(--mat-list-list-item-container-shape, var(--mat-sys-corner-none));\n}\n.mdc-list-item.mdc-list-item--selected {\n  background-color: var(--mat-list-list-item-selected-container-color);\n}\n.mdc-list-item:focus {\n  outline: 0;\n}\n.mdc-list-item.mdc-list-item--disabled {\n  cursor: auto;\n}\n.mdc-list-item.mdc-list-item--with-one-line {\n  height: var(--mat-list-list-item-one-line-container-height, 48px);\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__start {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-two-lines {\n  height: var(--mat-list-list-item-two-line-container-height, 64px);\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-three-lines {\n  height: var(--mat-list-list-item-three-line-container-height, 88px);\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--selected::before, .mdc-list-item.mdc-list-item--selected:focus::before, .mdc-list-item:not(.mdc-list-item--selected):focus::before {\n  position: absolute;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n  content: \"\";\n  pointer-events: none;\n}\n\na.mdc-list-item {\n  color: inherit;\n  text-decoration: none;\n}\n\n.mdc-list-item__start {\n  fill: currentColor;\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-leading-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-leading-icon-size, 24px);\n  height: var(--mat-list-list-item-leading-icon-size, 24px);\n  margin-left: 16px;\n  margin-right: 32px;\n}\n[dir=rtl] .mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-left: 32px;\n  margin-right: 16px;\n}\n.mdc-list-item--with-leading-icon:hover .mdc-list-item__start {\n  color: var(--mat-list-list-item-hover-leading-icon-color);\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  width: var(--mat-list-list-item-leading-avatar-size, 40px);\n  height: var(--mat-list-list-item-leading-avatar-size, 40px);\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start, [dir=rtl] .mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n\n.mdc-list-item__end {\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  font-family: var(--mat-list-list-item-trailing-supporting-text-font, var(--mat-sys-label-small-font));\n  line-height: var(--mat-list-list-item-trailing-supporting-text-line-height, var(--mat-sys-label-small-line-height));\n  font-size: var(--mat-list-list-item-trailing-supporting-text-size, var(--mat-sys-label-small-size));\n  font-weight: var(--mat-list-list-item-trailing-supporting-text-weight, var(--mat-sys-label-small-weight));\n  letter-spacing: var(--mat-list-list-item-trailing-supporting-text-tracking, var(--mat-sys-label-small-tracking));\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-trailing-icon-size, 24px);\n  height: var(--mat-list-list-item-trailing-icon-size, 24px);\n}\n.mdc-list-item--with-trailing-icon:hover .mdc-list-item__end {\n  color: var(--mat-list-list-item-hover-trailing-icon-color);\n}\n.mdc-list-item.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-supporting-text-color, var(--mat-sys-on-surface-variant));\n}\n.mdc-list-item--selected.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-selected-trailing-icon-color, var(--mat-sys-primary));\n}\n\n.mdc-list-item__content {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  align-self: center;\n  flex: 1;\n  pointer-events: none;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__content, .mdc-list-item--with-three-lines .mdc-list-item__content {\n  align-self: stretch;\n}\n\n.mdc-list-item__primary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  color: var(--mat-list-list-item-label-text-color, var(--mat-sys-on-surface));\n  font-family: var(--mat-list-list-item-label-text-font, var(--mat-sys-body-large-font));\n  line-height: var(--mat-list-list-item-label-text-line-height, var(--mat-sys-body-large-line-height));\n  font-size: var(--mat-list-list-item-label-text-size, var(--mat-sys-body-large-size));\n  font-weight: var(--mat-list-list-item-label-text-weight, var(--mat-sys-body-large-weight));\n  letter-spacing: var(--mat-list-list-item-label-text-tracking, var(--mat-sys-body-large-tracking));\n}\n.mdc-list-item:hover .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-hover-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item:focus .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-focus-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text, .mdc-list-item--with-three-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n\n.mdc-list-item__secondary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  display: block;\n  margin-top: 0;\n  color: var(--mat-list-list-item-supporting-text-color, var(--mat-sys-on-surface-variant));\n  font-family: var(--mat-list-list-item-supporting-text-font, var(--mat-sys-body-medium-font));\n  line-height: var(--mat-list-list-item-supporting-text-line-height, var(--mat-sys-body-medium-line-height));\n  font-size: var(--mat-list-list-item-supporting-text-size, var(--mat-sys-body-medium-size));\n  font-weight: var(--mat-list-list-item-supporting-text-weight, var(--mat-sys-body-medium-weight));\n  letter-spacing: var(--mat-list-list-item-supporting-text-tracking, var(--mat-sys-body-medium-tracking));\n}\n.mdc-list-item__secondary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-three-lines .mdc-list-item__secondary-text {\n  white-space: normal;\n  line-height: 20px;\n}\n.mdc-list-item--with-overline .mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: auto;\n}\n\n.mdc-list-item--with-leading-radio.mdc-list-item,\n.mdc-list-item--with-leading-checkbox.mdc-list-item,\n.mdc-list-item--with-leading-icon.mdc-list-item,\n.mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-checkbox.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-icon.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-trailing-icon.mdc-list-item, [dir=rtl] .mdc-list-item--with-trailing-icon.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n}\n\n.mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  -webkit-user-select: none;\n  user-select: none;\n  margin-left: 28px;\n  margin-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 28px;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end {\n  display: block;\n  line-height: normal;\n  align-self: flex-start;\n  margin-top: 0;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end::before, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-leading-radio .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio .mdc-list-item__start,\n[dir=rtl] .mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-item--with-trailing-radio.mdc-list-item,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-left: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, [dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-radio .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio .mdc-list-item__end,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-three-lines .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-group__subheader {\n  margin: 0.75rem 16px;\n}\n\n.mdc-list-item--disabled .mdc-list-item__start,\n.mdc-list-item--disabled .mdc-list-item__content,\n.mdc-list-item--disabled .mdc-list-item__end {\n  opacity: 1;\n}\n.mdc-list-item--disabled .mdc-list-item__primary-text,\n.mdc-list-item--disabled .mdc-list-item__secondary-text {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n.mdc-list-item--disabled.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-disabled-leading-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-leading-icon-opacity, 0.38);\n}\n.mdc-list-item--disabled.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-disabled-trailing-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-trailing-icon-opacity, 0.38);\n}\n\n.mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing, [dir=rtl] .mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing {\n  padding-left: 0;\n  padding-right: 0;\n}\n\n.mdc-list-item.mdc-list-item--disabled .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-disabled-label-text-color, var(--mat-sys-on-surface));\n}\n\n.mdc-list-item:hover::before {\n  background-color: var(--mat-list-list-item-hover-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));\n}\n\n.mdc-list-item.mdc-list-item--disabled::before {\n  background-color: var(--mat-list-list-item-disabled-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item:focus::before {\n  background-color: var(--mat-list-list-item-focus-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item--disabled .mdc-radio,\n.mdc-list-item--disabled .mdc-checkbox {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n\n.mdc-list-item--with-leading-avatar .mat-mdc-list-item-avatar {\n  border-radius: var(--mat-list-list-item-leading-avatar-shape, var(--mat-sys-corner-full));\n  background-color: var(--mat-list-list-item-leading-avatar-color, var(--mat-sys-primary-container));\n}\n\n.mat-mdc-list-item-icon {\n  font-size: var(--mat-list-list-item-leading-icon-size, 24px);\n}\n\n@media (forced-colors: active) {\n  a.mdc-list-item--activated::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  a.mdc-list-item--activated [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n\n.mat-mdc-list-base {\n  display: block;\n}\n.mat-mdc-list-base .mdc-list-item__start,\n.mat-mdc-list-base .mdc-list-item__end,\n.mat-mdc-list-base .mdc-list-item__content {\n  pointer-events: auto;\n}\n\n.mat-mdc-list-item,\n.mat-mdc-list-option {\n  width: 100%;\n  box-sizing: border-box;\n  -webkit-tap-highlight-color: transparent;\n}\n.mat-mdc-list-item:not(.mat-mdc-list-item-interactive),\n.mat-mdc-list-option:not(.mat-mdc-list-item-interactive) {\n  cursor: default;\n}\n.mat-mdc-list-item .mat-divider-inset,\n.mat-mdc-list-option .mat-divider-inset {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n}\n.mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n.mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-left: 72px;\n}\n[dir=rtl] .mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n[dir=rtl] .mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-right: 72px;\n}\n\n.mat-mdc-list-item-interactive::before {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  content: \"\";\n  opacity: 0;\n  pointer-events: none;\n  border-radius: inherit;\n}\n\n.mat-mdc-list-item > .mat-focus-indicator {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  pointer-events: none;\n}\n.mat-mdc-list-item:focus-visible > .mat-focus-indicator::before {\n  content: \"\";\n}\n\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-line.mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: normal;\n}\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-unscoped-content.mdc-list-item__secondary-text {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n\nmat-action-list button {\n  background: none;\n  color: inherit;\n  border: none;\n  font: inherit;\n  outline: inherit;\n  -webkit-tap-highlight-color: transparent;\n  text-align: start;\n}\nmat-action-list button::-moz-focus-inner {\n  border: 0;\n}\n\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-inline-start: var(--mat-list-list-item-leading-icon-start-space, 16px);\n  margin-inline-end: var(--mat-list-list-item-leading-icon-end-space, 16px);\n}\n\n.mat-mdc-nav-list .mat-mdc-list-item {\n  border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n  --mat-focus-indicator-border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n}\n.mat-mdc-nav-list .mat-mdc-list-item.mdc-list-item--activated {\n  background-color: var(--mat-list-active-indicator-color, var(--mat-sys-secondary-container));\n}\n"]
		}]
	}], null, null);
})();
var MAT_SELECTION_LIST_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => MatSelectionList),
	multi: true
};
var MatSelectionListChange = class {
	source;
	options;
	constructor(source, options) {
		this.source = source;
		this.options = options;
	}
};
var MatSelectionList = class MatSelectionList extends MatListBase {
	_element = inject(ElementRef);
	_ngZone = inject(NgZone);
	_renderer = inject(Renderer2);
	_initialized = false;
	_keyManager;
	_listenerCleanups;
	_destroyed = new Subject();
	_isDestroyed = false;
	_onChange = (_) => {};
	_items;
	selectionChange = new EventEmitter();
	color = "accent";
	compareWith = (a1, a2) => a1 === a2;
	get multiple() {
		return this._multiple;
	}
	set multiple(value) {
		const newValue = coerceBooleanProperty(value);
		if (newValue !== this._multiple) {
			if ((typeof ngDevMode === "undefined" || ngDevMode) && this._initialized) throw new Error("Cannot change `multiple` mode of mat-selection-list after initialization.");
			this._multiple = newValue;
			this.selectedOptions = new SelectionModel(this._multiple, this.selectedOptions.selected);
		}
	}
	_multiple = true;
	get hideSingleSelectionIndicator() {
		return this._hideSingleSelectionIndicator;
	}
	set hideSingleSelectionIndicator(value) {
		this._hideSingleSelectionIndicator = coerceBooleanProperty(value);
	}
	_hideSingleSelectionIndicator = this._defaultOptions?.hideSingleSelectionIndicator ?? false;
	selectedOptions = new SelectionModel(this._multiple);
	_value = null;
	_onTouched = () => {};
	_changeDetectorRef = inject(ChangeDetectorRef);
	constructor() {
		super();
		this._isNonInteractive = false;
	}
	ngAfterViewInit() {
		this._initialized = true;
		this._setupRovingTabindex();
		this._ngZone.runOutsideAngular(() => {
			this._listenerCleanups = [this._renderer.listen(this._element.nativeElement, "focusin", this._handleFocusin), this._renderer.listen(this._element.nativeElement, "focusout", this._handleFocusout)];
		});
		if (this._value) this._setOptionsFromValues(this._value);
		this._watchForSelectionChange();
	}
	ngOnChanges(changes) {
		const disabledChanges = changes["disabled"];
		const disableRippleChanges = changes["disableRipple"];
		const hideSingleSelectionIndicatorChanges = changes["hideSingleSelectionIndicator"];
		if (disableRippleChanges && !disableRippleChanges.firstChange || disabledChanges && !disabledChanges.firstChange || hideSingleSelectionIndicatorChanges && !hideSingleSelectionIndicatorChanges.firstChange) this._markOptionsForCheck();
	}
	ngOnDestroy() {
		this._keyManager?.destroy();
		this._listenerCleanups?.forEach((current) => current());
		this._destroyed.next();
		this._destroyed.complete();
		this._isDestroyed = true;
	}
	focus(options) {
		this._element.nativeElement.focus(options);
	}
	selectAll() {
		return this._setAllOptionsSelected(true);
	}
	deselectAll() {
		return this._setAllOptionsSelected(false);
	}
	_reportValueChange() {
		if (this.options && !this._isDestroyed) {
			const value = this._getSelectedOptionValues();
			this._onChange(value);
			this._value = value;
		}
	}
	_emitChangeEvent(options) {
		this.selectionChange.emit(new MatSelectionListChange(this, options));
	}
	writeValue(values) {
		this._value = values;
		if (this.options) this._setOptionsFromValues(values || []);
	}
	setDisabledState(isDisabled) {
		this.disabled = isDisabled;
		this._changeDetectorRef.markForCheck();
		this._markOptionsForCheck();
	}
	get disabled() {
		return this._selectionListDisabled();
	}
	set disabled(value) {
		this._selectionListDisabled.set(coerceBooleanProperty(value));
		if (this._selectionListDisabled()) this._keyManager?.setActiveItem(-1);
	}
	_selectionListDisabled = signal(false, ...ngDevMode ? [{ debugName: "_selectionListDisabled" }] : []);
	registerOnChange(fn) {
		this._onChange = fn;
	}
	registerOnTouched(fn) {
		this._onTouched = fn;
	}
	_watchForSelectionChange() {
		this.selectedOptions.changed.pipe(takeUntil(this._destroyed)).subscribe((event) => {
			for (let item of event.added) item.selected = true;
			for (let item of event.removed) item.selected = false;
			if (!this._containsFocus()) this._resetActiveOption();
		});
	}
	_setOptionsFromValues(values) {
		this.options.forEach((option) => option._setSelected(false));
		values.forEach((value) => {
			const correspondingOption = this.options.find((option) => {
				return option.selected ? false : this.compareWith(option.value, value);
			});
			if (correspondingOption) correspondingOption._setSelected(true);
		});
	}
	_getSelectedOptionValues() {
		return this.options.filter((option) => option.selected).map((option) => option.value);
	}
	_markOptionsForCheck() {
		if (this.options) this.options.forEach((option) => option._markForCheck());
	}
	_setAllOptionsSelected(isSelected, skipDisabled) {
		const changedOptions = [];
		this.options.forEach((option) => {
			if ((!skipDisabled || !option.disabled) && option._setSelected(isSelected)) changedOptions.push(option);
		});
		if (changedOptions.length) this._reportValueChange();
		return changedOptions;
	}
	get options() {
		return this._items;
	}
	_handleKeydown(event) {
		const activeItem = this._keyManager.activeItem;
		if (activeItem && (event.keyCode === 40 || event.keyCode === 38)) {
			const focusedElement = _getFocusedElementPierceShadowDom();
			if (!this._items.toArray().some((item) => item._elementRef.nativeElement === focusedElement)) {
				event.preventDefault();
				activeItem.focus();
				return;
			}
		}
		if ((event.keyCode === 13 || event.keyCode === 32) && !this._keyManager.isTyping() && activeItem && !activeItem.disabled) {
			event.preventDefault();
			activeItem._toggleOnInteraction();
		} else if (event.keyCode === 65 && this.multiple && !this._keyManager.isTyping() && hasModifierKey(event, "ctrlKey", "metaKey")) {
			const shouldSelect = this.options.some((option) => !option.disabled && !option.selected);
			event.preventDefault();
			this._emitChangeEvent(this._setAllOptionsSelected(shouldSelect, true));
		} else this._keyManager.onKeydown(event);
	}
	_handleFocusout = () => {
		setTimeout(() => {
			if (!this._containsFocus()) this._resetActiveOption();
		});
	};
	_handleFocusin = (event) => {
		const activeIndex = this._items.toArray().findIndex((item) => item._elementRef.nativeElement.contains(event.target));
		if (activeIndex > -1) this._setActiveOption(activeIndex);
		else this._resetActiveOption();
	};
	_setupRovingTabindex() {
		this._keyManager = new FocusKeyManager(this._items).withHomeAndEnd().withTypeAhead().withWrap().skipPredicate(() => false);
		this._resetActiveOption();
		this._keyManager.change.subscribe((activeItemIndex) => this._setActiveOption(activeItemIndex));
		this._items.changes.pipe(takeUntil(this._destroyed)).subscribe(() => {
			const activeItem = this._keyManager.activeItem;
			if (!activeItem || this._items.toArray().indexOf(activeItem) === -1) this._resetActiveOption();
		});
	}
	_setActiveOption(index) {
		this._items.forEach((item, itemIndex) => {
			let tabindex = -1;
			if (!this.disabled && itemIndex === index) tabindex = 0;
			item._setTabindex(tabindex);
		});
		this._keyManager.updateActiveItem(index);
	}
	_resetActiveOption() {
		if (this.disabled) {
			const activeItem = this._items.find((item) => item.selected) || this._items.first;
			const index = activeItem ? this._items.toArray().indexOf(activeItem) : -1;
			this._setActiveOption(index);
			return;
		}
		const activeItem = this._items.find((item) => item.selected && !item.disabled) || this._items.first;
		this._setActiveOption(activeItem ? this._items.toArray().indexOf(activeItem) : -1);
	}
	_containsFocus() {
		const activeElement = _getFocusedElementPierceShadowDom();
		return activeElement && this._element.nativeElement.contains(activeElement);
	}
	static ɵfac = function MatSelectionList_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatSelectionList)();
	};
	static ɵcmp = /* @__PURE__ */ ɵɵdefineComponent({
		type: MatSelectionList,
		selectors: [["mat-selection-list"]],
		contentQueries: function MatSelectionList_ContentQueries(rf, ctx, dirIndex) {
			if (rf & 1) ɵɵcontentQuery(dirIndex, MatListOption, 5);
			if (rf & 2) {
				let _t;
				ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx._items = _t);
			}
		},
		hostAttrs: [
			"role",
			"listbox",
			1,
			"mat-mdc-selection-list",
			"mat-mdc-list-base",
			"mdc-list"
		],
		hostVars: 1,
		hostBindings: function MatSelectionList_HostBindings(rf, ctx) {
			if (rf & 1) ɵɵlistener("keydown", function MatSelectionList_keydown_HostBindingHandler($event) {
				return ctx._handleKeydown($event);
			});
			if (rf & 2) ɵɵattribute("aria-multiselectable", ctx.multiple);
		},
		inputs: {
			color: "color",
			compareWith: "compareWith",
			multiple: "multiple",
			hideSingleSelectionIndicator: "hideSingleSelectionIndicator",
			disabled: "disabled"
		},
		outputs: { selectionChange: "selectionChange" },
		exportAs: ["matSelectionList"],
		features: [
			ɵɵProvidersFeature([
				MAT_SELECTION_LIST_VALUE_ACCESSOR,
				{
					provide: MatListBase,
					useExisting: MatSelectionList
				},
				{
					provide: SELECTION_LIST,
					useExisting: MatSelectionList
				}
			]),
			ɵɵInheritDefinitionFeature,
			ɵɵNgOnChangesFeature
		],
		ngContentSelectors: _c0,
		decls: 1,
		vars: 0,
		template: function MatSelectionList_Template(rf, ctx) {
			if (rf & 1) {
				ɵɵprojectionDef();
				ɵɵprojection(0);
			}
		},
		styles: [_c1],
		encapsulation: 2
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatSelectionList, [{
		type: Component,
		args: [{
			selector: "mat-selection-list",
			exportAs: "matSelectionList",
			host: {
				"class": "mat-mdc-selection-list mat-mdc-list-base mdc-list",
				"role": "listbox",
				"[attr.aria-multiselectable]": "multiple",
				"(keydown)": "_handleKeydown($event)"
			},
			template: "<ng-content></ng-content>",
			encapsulation: ViewEncapsulation.None,
			providers: [
				MAT_SELECTION_LIST_VALUE_ACCESSOR,
				{
					provide: MatListBase,
					useExisting: MatSelectionList
				},
				{
					provide: SELECTION_LIST,
					useExisting: MatSelectionList
				}
			],
			styles: [".mdc-list {\n  margin: 0;\n  padding: 8px 0;\n  list-style-type: none;\n}\n.mdc-list:focus {\n  outline: none;\n}\n\n.mdc-list-item {\n  display: flex;\n  position: relative;\n  justify-content: flex-start;\n  overflow: hidden;\n  padding: 0;\n  align-items: stretch;\n  cursor: pointer;\n  padding-left: 16px;\n  padding-right: 16px;\n  background-color: var(--mat-list-list-item-container-color, transparent);\n  border-radius: var(--mat-list-list-item-container-shape, var(--mat-sys-corner-none));\n}\n.mdc-list-item.mdc-list-item--selected {\n  background-color: var(--mat-list-list-item-selected-container-color);\n}\n.mdc-list-item:focus {\n  outline: 0;\n}\n.mdc-list-item.mdc-list-item--disabled {\n  cursor: auto;\n}\n.mdc-list-item.mdc-list-item--with-one-line {\n  height: var(--mat-list-list-item-one-line-container-height, 48px);\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__start {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-one-line .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-two-lines {\n  height: var(--mat-list-list-item-two-line-container-height, 64px);\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-two-lines .mdc-list-item__end {\n  align-self: center;\n  margin-top: 0;\n}\n.mdc-list-item.mdc-list-item--with-three-lines {\n  height: var(--mat-list-list-item-three-line-container-height, 88px);\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 16px;\n}\n.mdc-list-item.mdc-list-item--selected::before, .mdc-list-item.mdc-list-item--selected:focus::before, .mdc-list-item:not(.mdc-list-item--selected):focus::before {\n  position: absolute;\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n  content: \"\";\n  pointer-events: none;\n}\n\na.mdc-list-item {\n  color: inherit;\n  text-decoration: none;\n}\n\n.mdc-list-item__start {\n  fill: currentColor;\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-leading-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-leading-icon-size, 24px);\n  height: var(--mat-list-list-item-leading-icon-size, 24px);\n  margin-left: 16px;\n  margin-right: 32px;\n}\n[dir=rtl] .mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-left: 32px;\n  margin-right: 16px;\n}\n.mdc-list-item--with-leading-icon:hover .mdc-list-item__start {\n  color: var(--mat-list-list-item-hover-leading-icon-color);\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  width: var(--mat-list-list-item-leading-avatar-size, 40px);\n  height: var(--mat-list-list-item-leading-avatar-size, 40px);\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n.mdc-list-item--with-leading-avatar .mdc-list-item__start, [dir=rtl] .mdc-list-item--with-leading-avatar .mdc-list-item__start {\n  margin-left: 16px;\n  margin-right: 16px;\n  border-radius: 50%;\n}\n\n.mdc-list-item__end {\n  flex-shrink: 0;\n  pointer-events: none;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  font-family: var(--mat-list-list-item-trailing-supporting-text-font, var(--mat-sys-label-small-font));\n  line-height: var(--mat-list-list-item-trailing-supporting-text-line-height, var(--mat-sys-label-small-line-height));\n  font-size: var(--mat-list-list-item-trailing-supporting-text-size, var(--mat-sys-label-small-size));\n  font-weight: var(--mat-list-list-item-trailing-supporting-text-weight, var(--mat-sys-label-small-weight));\n  letter-spacing: var(--mat-list-list-item-trailing-supporting-text-tracking, var(--mat-sys-label-small-tracking));\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-icon-color, var(--mat-sys-on-surface-variant));\n  width: var(--mat-list-list-item-trailing-icon-size, 24px);\n  height: var(--mat-list-list-item-trailing-icon-size, 24px);\n}\n.mdc-list-item--with-trailing-icon:hover .mdc-list-item__end {\n  color: var(--mat-list-list-item-hover-trailing-icon-color);\n}\n.mdc-list-item.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  color: var(--mat-list-list-item-trailing-supporting-text-color, var(--mat-sys-on-surface-variant));\n}\n.mdc-list-item--selected.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-selected-trailing-icon-color, var(--mat-sys-primary));\n}\n\n.mdc-list-item__content {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  align-self: center;\n  flex: 1;\n  pointer-events: none;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__content, .mdc-list-item--with-three-lines .mdc-list-item__content {\n  align-self: stretch;\n}\n\n.mdc-list-item__primary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  color: var(--mat-list-list-item-label-text-color, var(--mat-sys-on-surface));\n  font-family: var(--mat-list-list-item-label-text-font, var(--mat-sys-body-large-font));\n  line-height: var(--mat-list-list-item-label-text-line-height, var(--mat-sys-body-large-line-height));\n  font-size: var(--mat-list-list-item-label-text-size, var(--mat-sys-body-large-size));\n  font-weight: var(--mat-list-list-item-label-text-weight, var(--mat-sys-body-large-weight));\n  letter-spacing: var(--mat-list-list-item-label-text-tracking, var(--mat-sys-body-large-tracking));\n}\n.mdc-list-item:hover .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-hover-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item:focus .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-focus-label-text-color, var(--mat-sys-on-surface));\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text, .mdc-list-item--with-three-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after, .mdc-list-item--with-three-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n\n.mdc-list-item__secondary-text {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n  display: block;\n  margin-top: 0;\n  color: var(--mat-list-list-item-supporting-text-color, var(--mat-sys-on-surface-variant));\n  font-family: var(--mat-list-list-item-supporting-text-font, var(--mat-sys-body-medium-font));\n  line-height: var(--mat-list-list-item-supporting-text-line-height, var(--mat-sys-body-medium-line-height));\n  font-size: var(--mat-list-list-item-supporting-text-size, var(--mat-sys-body-medium-size));\n  font-weight: var(--mat-list-list-item-supporting-text-weight, var(--mat-sys-body-medium-weight));\n  letter-spacing: var(--mat-list-list-item-supporting-text-tracking, var(--mat-sys-body-medium-tracking));\n}\n.mdc-list-item__secondary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-three-lines .mdc-list-item__secondary-text {\n  white-space: normal;\n  line-height: 20px;\n}\n.mdc-list-item--with-overline .mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: auto;\n}\n\n.mdc-list-item--with-leading-radio.mdc-list-item,\n.mdc-list-item--with-leading-checkbox.mdc-list-item,\n.mdc-list-item--with-leading-icon.mdc-list-item,\n.mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-checkbox.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-icon.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-leading-avatar.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n  margin-bottom: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines .mdc-list-item__primary-text::after {\n  display: inline-block;\n  width: 0;\n  height: 20px;\n  content: \"\";\n  vertical-align: -20px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  display: block;\n  margin-top: 0;\n  line-height: normal;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-icon.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before,\n.mdc-list-item--with-leading-avatar.mdc-list-item--with-two-lines.mdc-list-item--with-trailing-meta .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 32px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-trailing-icon.mdc-list-item, [dir=rtl] .mdc-list-item--with-trailing-icon.mdc-list-item {\n  padding-left: 0;\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 16px;\n}\n\n.mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  -webkit-user-select: none;\n  user-select: none;\n  margin-left: 28px;\n  margin-right: 16px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-meta .mdc-list-item__end {\n  margin-left: 16px;\n  margin-right: 28px;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end {\n  display: block;\n  line-height: normal;\n  align-self: flex-start;\n  margin-top: 0;\n}\n.mdc-list-item--with-trailing-meta.mdc-list-item--with-three-lines .mdc-list-item__end::before, .mdc-list-item--with-trailing-meta.mdc-list-item--with-two-lines .mdc-list-item__end::before {\n  display: inline-block;\n  width: 0;\n  height: 28px;\n  content: \"\";\n  vertical-align: 0;\n}\n\n.mdc-list-item--with-leading-radio .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n[dir=rtl] .mdc-list-item--with-leading-radio .mdc-list-item__start,\n[dir=rtl] .mdc-list-item--with-leading-checkbox .mdc-list-item__start {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n.mdc-list-item--with-leading-radio.mdc-list-item--with-two-lines .mdc-list-item__start,\n.mdc-list-item--with-leading-checkbox.mdc-list-item--with-two-lines .mdc-list-item__start {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-item--with-trailing-radio.mdc-list-item,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 16px;\n  padding-right: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item {\n  padding-left: 0;\n  padding-right: 16px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-left: 0;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-icon, [dir=rtl] .mdc-list-item--with-trailing-radio.mdc-list-item--with-leading-avatar,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-icon,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox.mdc-list-item--with-leading-avatar {\n  padding-right: 0;\n}\n.mdc-list-item--with-trailing-radio .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 24px;\n  margin-right: 8px;\n}\n[dir=rtl] .mdc-list-item--with-trailing-radio .mdc-list-item__end,\n[dir=rtl] .mdc-list-item--with-trailing-checkbox .mdc-list-item__end {\n  margin-left: 8px;\n  margin-right: 24px;\n}\n.mdc-list-item--with-trailing-radio.mdc-list-item--with-three-lines .mdc-list-item__end,\n.mdc-list-item--with-trailing-checkbox.mdc-list-item--with-three-lines .mdc-list-item__end {\n  align-self: flex-start;\n  margin-top: 8px;\n}\n\n.mdc-list-group__subheader {\n  margin: 0.75rem 16px;\n}\n\n.mdc-list-item--disabled .mdc-list-item__start,\n.mdc-list-item--disabled .mdc-list-item__content,\n.mdc-list-item--disabled .mdc-list-item__end {\n  opacity: 1;\n}\n.mdc-list-item--disabled .mdc-list-item__primary-text,\n.mdc-list-item--disabled .mdc-list-item__secondary-text {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n.mdc-list-item--disabled.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  color: var(--mat-list-list-item-disabled-leading-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-leading-icon-opacity, 0.38);\n}\n.mdc-list-item--disabled.mdc-list-item--with-trailing-icon .mdc-list-item__end {\n  color: var(--mat-list-list-item-disabled-trailing-icon-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-trailing-icon-opacity, 0.38);\n}\n\n.mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing, [dir=rtl] .mat-mdc-list-item.mat-mdc-list-item-both-leading-and-trailing {\n  padding-left: 0;\n  padding-right: 0;\n}\n\n.mdc-list-item.mdc-list-item--disabled .mdc-list-item__primary-text {\n  color: var(--mat-list-list-item-disabled-label-text-color, var(--mat-sys-on-surface));\n}\n\n.mdc-list-item:hover::before {\n  background-color: var(--mat-list-list-item-hover-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));\n}\n\n.mdc-list-item.mdc-list-item--disabled::before {\n  background-color: var(--mat-list-list-item-disabled-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-disabled-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item:focus::before {\n  background-color: var(--mat-list-list-item-focus-state-layer-color, var(--mat-sys-on-surface));\n  opacity: var(--mat-list-list-item-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));\n}\n\n.mdc-list-item--disabled .mdc-radio,\n.mdc-list-item--disabled .mdc-checkbox {\n  opacity: var(--mat-list-list-item-disabled-label-text-opacity, 0.3);\n}\n\n.mdc-list-item--with-leading-avatar .mat-mdc-list-item-avatar {\n  border-radius: var(--mat-list-list-item-leading-avatar-shape, var(--mat-sys-corner-full));\n  background-color: var(--mat-list-list-item-leading-avatar-color, var(--mat-sys-primary-container));\n}\n\n.mat-mdc-list-item-icon {\n  font-size: var(--mat-list-list-item-leading-icon-size, 24px);\n}\n\n@media (forced-colors: active) {\n  a.mdc-list-item--activated::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    right: 16px;\n    transform: translateY(-50%);\n    width: 10px;\n    height: 0;\n    border-bottom: solid 10px;\n    border-radius: 10px;\n  }\n  a.mdc-list-item--activated [dir=rtl]::after {\n    right: auto;\n    left: 16px;\n  }\n}\n\n.mat-mdc-list-base {\n  display: block;\n}\n.mat-mdc-list-base .mdc-list-item__start,\n.mat-mdc-list-base .mdc-list-item__end,\n.mat-mdc-list-base .mdc-list-item__content {\n  pointer-events: auto;\n}\n\n.mat-mdc-list-item,\n.mat-mdc-list-option {\n  width: 100%;\n  box-sizing: border-box;\n  -webkit-tap-highlight-color: transparent;\n}\n.mat-mdc-list-item:not(.mat-mdc-list-item-interactive),\n.mat-mdc-list-option:not(.mat-mdc-list-item-interactive) {\n  cursor: default;\n}\n.mat-mdc-list-item .mat-divider-inset,\n.mat-mdc-list-option .mat-divider-inset {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n}\n.mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n.mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-left: 72px;\n}\n[dir=rtl] .mat-mdc-list-item .mat-mdc-list-item-avatar ~ .mat-divider-inset,\n[dir=rtl] .mat-mdc-list-option .mat-mdc-list-item-avatar ~ .mat-divider-inset {\n  margin-right: 72px;\n}\n\n.mat-mdc-list-item-interactive::before {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  content: \"\";\n  opacity: 0;\n  pointer-events: none;\n  border-radius: inherit;\n}\n\n.mat-mdc-list-item > .mat-focus-indicator {\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  position: absolute;\n  pointer-events: none;\n}\n.mat-mdc-list-item:focus-visible > .mat-focus-indicator::before {\n  content: \"\";\n}\n\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-line.mdc-list-item__secondary-text {\n  white-space: nowrap;\n  line-height: normal;\n}\n.mat-mdc-list-item.mdc-list-item--with-three-lines .mat-mdc-list-item-unscoped-content.mdc-list-item__secondary-text {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n\nmat-action-list button {\n  background: none;\n  color: inherit;\n  border: none;\n  font: inherit;\n  outline: inherit;\n  -webkit-tap-highlight-color: transparent;\n  text-align: start;\n}\nmat-action-list button::-moz-focus-inner {\n  border: 0;\n}\n\n.mdc-list-item--with-leading-icon .mdc-list-item__start {\n  margin-inline-start: var(--mat-list-list-item-leading-icon-start-space, 16px);\n  margin-inline-end: var(--mat-list-list-item-leading-icon-end-space, 16px);\n}\n\n.mat-mdc-nav-list .mat-mdc-list-item {\n  border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n  --mat-focus-indicator-border-radius: var(--mat-list-active-indicator-shape, var(--mat-sys-corner-full));\n}\n.mat-mdc-nav-list .mat-mdc-list-item.mdc-list-item--activated {\n  background-color: var(--mat-list-active-indicator-color, var(--mat-sys-secondary-container));\n}\n"]
		}]
	}], () => [], {
		_items: [{
			type: ContentChildren,
			args: [MatListOption, { descendants: true }]
		}],
		selectionChange: [{ type: Output }],
		color: [{ type: Input }],
		compareWith: [{ type: Input }],
		multiple: [{ type: Input }],
		hideSingleSelectionIndicator: [{ type: Input }],
		disabled: [{ type: Input }]
	});
})();
var MatListModule = class MatListModule {
	static ɵfac = function MatListModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatListModule)();
	};
	static ɵmod = /* @__PURE__ */ ɵɵdefineNgModule({
		type: MatListModule,
		imports: [
			ObserversModule,
			MatRippleModule,
			MatPseudoCheckboxModule,
			MatList,
			MatActionList,
			MatNavList,
			MatSelectionList,
			MatListItem,
			MatListOption,
			MatListSubheaderCssMatStyler,
			MatListItemAvatar,
			MatListItemIcon,
			MatListItemLine,
			MatListItemTitle,
			MatListItemMeta
		],
		exports: [
			BidiModule,
			MatList,
			MatActionList,
			MatNavList,
			MatSelectionList,
			MatListItem,
			MatListOption,
			MatListItemAvatar,
			MatListItemIcon,
			MatListSubheaderCssMatStyler,
			MatDividerModule,
			MatListItemLine,
			MatListItemTitle,
			MatListItemMeta
		]
	});
	static ɵinj = /* @__PURE__ */ ɵɵdefineInjector({ imports: [
		ObserversModule,
		MatRippleModule,
		MatPseudoCheckboxModule,
		BidiModule,
		MatDividerModule
	] });
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatListModule, [{
		type: NgModule,
		args: [{
			imports: [
				ObserversModule,
				MatRippleModule,
				MatPseudoCheckboxModule,
				MatList,
				MatActionList,
				MatNavList,
				MatSelectionList,
				MatListItem,
				MatListOption,
				MatListSubheaderCssMatStyler,
				MatListItemAvatar,
				MatListItemIcon,
				MatListItemLine,
				MatListItemTitle,
				MatListItemMeta
			],
			exports: [
				BidiModule,
				MatList,
				MatActionList,
				MatNavList,
				MatSelectionList,
				MatListItem,
				MatListOption,
				MatListItemAvatar,
				MatListItemIcon,
				MatListSubheaderCssMatStyler,
				MatDividerModule,
				MatListItemLine,
				MatListItemTitle,
				MatListItemMeta
			]
		}]
	}], null, null);
})();
//#endregion
export { MAT_LIST, MAT_LIST_CONFIG, MAT_NAV_LIST, MAT_SELECTION_LIST_VALUE_ACCESSOR, MatActionList, MatDivider, MatList, MatListItem, MatListItemAvatar, MatListItemIcon, MatListItemLine, MatListItemMeta, MatListItemTitle, MatListModule, MatListOption, MatListSubheaderCssMatStyler, MatNavList, MatSelectionList, MatSelectionListChange, SELECTION_LIST, _MatListItemGraphicBase };
