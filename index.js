/**
 * Modal Morph: An accessible morphing modal library.
 * Usage:
 * 		modalMorph('mm--contact', { trigger: yourButtonElement }).open();
 */

import FLIP from './src/FLIP';
import createFocusTrap from 'focus-trap';

/**
 * Setup modal
 * @param  {String} modalId		           		Id of modal's root HTML element (required)
 * @param  {HTMLElement} options.trigger 		Element modal should morph to & from
 * @param  {String/Function} options.bgColor    Background color of modal
 * @return {Object}                        		ModalMorph object
 */
export default function modalMorph(modalId, options = {}) {
	// Modal id is required
	const overlay = document.getElementById(modalId);
	if (!overlay) throw new Error('A valid modal id must be provided.');

	if (!options.trigger) throw new Error('A valid trigger element must be provided.');

	const defaults = {
		overlay,
		popup: overlay.querySelector('.mm__popup'),
		content: overlay.querySelector('.mm__content'),
		title: overlay.querySelector('.mm__title'),
		bgColor: getTriggerBgColor,
	},
		// Allow client to open and close the modal at will
		apiMethods = { open, close };

	let modal = Object.assign({}, defaults, options, apiMethods), isOpen = false;

	const focusTrap = createFocusTrap(modal.content, {
		onDeactivate: close,
		clickOutsideDeactivates: true,
	});

	return modal;

	/**
	 * Open modal
	 */
	function open() {
		if (isOpen) return;
		else isOpen = true;

		/**
		 * Prepare overlay for fade-in animation 
		 */
		modal.overlay.classList.add('mm--visible');

		const fadeInOverlay = prepareFlip(
			{
				element: modal.overlay,
				easing: easeIn,
				duration: 100,
			},
			overlay => overlay.classList.add('mm--opened')
		);

		/**
		 * Prepare popup for morph-in animation
		 */
		modal.popup.style.backgroundColor = typeof modal.bgColor === 'function'
			? modal.bgColor()
			: modal.bgColor;

		const tempStyle = positionPopupOverTrigger(),
			morphInPopup = prepareFlip(
				{
					element: modal.popup,
					easing: easeIn,
					delay: 50,
					duration: 400,
				},
				popup => {
					popup.classList.add('mm__popup--opened');
					document.head.removeChild(tempStyle);
				}
			);

		fadeInOverlay.play();
		morphInPopup.play();

		/**
		 * Fade in popup contents after popup animation completes
		 */
		afterFLIPs([fadeInOverlay, morphInPopup], () => {
			const fadeInContent = prepareFlip(
				{
					element: modal.content,
					easing: easeIn,
					duration: 300,
				},
				content => content.classList.add('mm__content--opened')
			);
			fadeInContent.play();

			/**
			 * Once content fades in, modal is ready to use
			 */
			afterFLIPs([fadeInContent], () => {
				// Activate focus trap
				focusTrap.activate();

				// When focus trap deactivates, the modal will automatically
				// close (e.g. Esc key pressed, click outside modal).
				// Also deactivate when a close button is pressed.
				modal.content.addEventListener('click', handleCloseButton);
			});
		});
	}

	function close() {
		if (!isOpen) return;
		else isOpen = false;

		// Cleanup event listeners on close buttons
		modal.content.removeEventListener('click', handleCloseButton);

		/**
		 * Fade out popup contents
		 */
		const fadeOutContent = prepareFlip(
			{
				element: modal.content,
				duration: 300,
			},
			content => content.classList.remove('mm__content--opened')
		);
		fadeOutContent.play();

		/**
		 * Once content fades out, dismiss popup and hide overlay
		 */
		afterFLIPs([fadeOutContent], () => {
			/**
			 * Prepare overlay for fade-out animation
			 */
			const fadeOutOverlay = prepareFlip(
				{
					element: modal.overlay,
					easing: easeInOut,
					duration: 400,
				},
				overlay => overlay.classList.remove('mm--opened')
			);

			/**
			 * Prepare popup for morph-out animation
			 */
			let tempStyle;
			const morphOutPopup = prepareFlip(
				{
					element: modal.popup,
					easing: easeInOut,
					duration: 300,
				},
				popup => {
					popup.classList.remove('mm__popup--opened');
					tempStyle = positionPopupOverTrigger();
				}
			);

			// Animate! Morph in popup and fade-in the overlay behind it
			fadeOutOverlay.play();
			morphOutPopup.play();

			/**
			 * Once modal has completely disappeared, remove temporary stylesheet
			 * and hide it from DOM and screen readers
			 */
			afterFLIPs([fadeOutOverlay, morphOutPopup], () => {
				document.head.removeChild(tempStyle);
				modal.overlay.classList.remove('mm--visible');
			});
		});
	}

	/**
	 * Setup a FLIP animation, running a custom callback
	 * function before the FLIP.last() step.
	 * @param  {Object}  	flipConfig 
	 * @param  {Function}  	beforeLast 
	 * @return {Object}
	 */
	function prepareFlip(flipConfig, beforeLast) {
		const flip = new FLIP(flipConfig);

		// First
		flip.first();

		// Last
		beforeLast(flip.element_);
		flip.last();

		// Invert
		flip.invert();

		return flip;
	}

	/**
	 * Run callback after FLIP animations complete
	 * @param  {Array} flipObjects	Array of FLIP objects
	 * @param  {Function} callback 	Callback function
	 */
	function afterFLIPs(flipObjects, callback) {
		// Find element whose animation will end last
		let elem = null, maxEndingTime = 0;

		flipObjects.forEach(({ delay_, duration_, element_ }) => {
			const endingTime = delay_ + duration_;
			if (endingTime > maxEndingTime) {
				maxEndingTime = endingTime;
				elem = element_;
			}
		});

		elem.addEventListener('flipComplete', handleFlipComplete);

		function handleFlipComplete(event) {
			// Ensure that the target of this event is the element we want it to be, and
			// not a child element that's also been animated recently.
			if (event.target !== elem) return;

			elem.removeEventListener('flipComplete', handleFlipComplete);
			callback();
		}
	}

	/**
	 * If a close button or its child was clicked, deactivate the focus
	 * traop to close the modal
	 */
	function handleCloseButton(event) {
		const element = event.target;
		if (isCloseButton(element) || isCloseButton(element.parentElement)) {
			focusTrap.deactivate();
		}

		function isCloseButton(element) {
			return element.classList.contains('mm__close');
		}
	}

	/**
	 * Get default background color for modal.
	 * Defaults to trigger's background color and falls back to 
	 * an empty string.
	 */
	function getTriggerBgColor() {
		return (modal.trigger && window.getComputedStyle(modal.trigger).backgroundColor) || '';
	}

	/**
	 * Position modal popup over the trigger element -or- in center of screen
	 * Instead of setting inline styles, create a temporarily stylesheet. This was we
	 * don't need to use !important's to actually position the popup where
	 * we want to on the screen once it's opened.
	 */
	function positionPopupOverTrigger() {
		const position = modal.trigger.getBoundingClientRect(),
			declarations = ['top', 'left', 'height', 'width']
				.map(prop => `${prop}: ${position[prop]}px;`)
				.join(' '),
			ruleSet = `#${modalId} .mm__popup { ${declarations} }`;

		// Create <style>
		let style = document.createElement('style');
		style.type = 'text/css';
		style.appendChild(document.createTextNode(ruleSet));

		// Inject <style> in <head> and return reference to it so it can be easily removed
		document.head.appendChild(style);

		return style;
	}

	// Quintic easing functions for animations
	// Tween.js (MIT license)
	// @source https://github.com/tweenjs/tween.js/blob/master/src/Tween.js
	function easeIn(t) {
		return --t * t * t * t * t + 1;
	}
	function easeInOut(t) {
		if ((t *= 2) < 1) {
			return 0.5 * t * t * t * t * t;
		}
		return 0.5 * ((t -= 2) * t * t * t * t + 2);
	}
}
