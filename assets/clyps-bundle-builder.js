/*
 * clyps Bundle Builder
 * Price preview + multi-item add to cart for sections/clyps-bundle-builder.liquid.
 * Products are added as separate cart lines so the shop's automatic discounts apply.
 */
(function () {
  if (window.customElements.get('clyps-bundle-builder')) return;

  class ClypsBundleBuilder extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.minClips = parseInt(this.dataset.minClips, 10) || 1;
      this.clipDiscount = parseFloat(this.dataset.clipDiscount) || 0;
      this.moneyFormat = this.dataset.moneyFormat || '{{amount}}';

      this.products = {};
      this.variants = {};
      this.querySelectorAll('script[data-cbb-product]').forEach((el) => {
        try {
          const product = JSON.parse(el.textContent);
          this.products[product.id] = product;
          product.variants.forEach((v) => {
            this.variants[v.id] = Object.assign({ productId: product.id, productTitle: product.title }, v);
          });
        } catch (e) {
          /* ignore malformed product data */
        }
      });

      this.addEventListener('change', this.onChange.bind(this));
      this.addEventListener('click', this.onClick.bind(this));
      this.addEventListener('keydown', this.onKeydown.bind(this));

      this.querySelectorAll('[data-cbb-bundle]').forEach((bundle) => this.update(bundle));
      this.initDots();
    }

    // Position dots for the swipeable set row on mobile (hidden via CSS from 768px).
    initDots() {
      const grid = this.querySelector('.cbb__grid');
      const dotsEl = this.querySelector('[data-cbb-dots]');
      if (!grid || !dotsEl) return;
      const items = Array.from(grid.children);
      if (items.length < 2) {
        dotsEl.hidden = true;
        return;
      }
      dotsEl.innerHTML = '';
      const dots = items.map(() => {
        const dot = document.createElement('span');
        dot.className = 'cbb__dot';
        dotsEl.appendChild(dot);
        return dot;
      });

      let frame = null;
      const update = () => {
        frame = null;
        const step = items[1].offsetLeft - items[0].offsetLeft || items[0].offsetWidth || 1;
        const scrolled = Math.abs(grid.scrollLeft);
        let index = Math.round(scrolled / step);
        if (scrolled + grid.clientWidth >= grid.scrollWidth - 2) index = items.length - 1;
        index = Math.max(0, Math.min(items.length - 1, index));
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
      };
      grid.addEventListener(
        'scroll',
        () => {
          if (frame === null) frame = window.requestAnimationFrame(update);
        },
        { passive: true }
      );
      window.addEventListener('resize', update, { passive: true });
      update();
    }

    onChange(event) {
      const bundle = event.target.closest('[data-cbb-bundle]');
      if (!bundle) return;
      this.setMessage(bundle, '');
      this.update(bundle);
    }

    onClick(event) {
      const toggle = event.target.closest('[data-cbb-toggle]');
      if (toggle) {
        this.togglePanel(toggle);
        return;
      }
      const pick = event.target.closest('[data-cbb-pick]');
      if (pick) {
        this.pickProduct(pick);
        return;
      }
      const slotBtn = event.target.closest('[data-cbb-slot-btn]');
      if (slotBtn) {
        this.onSlotClick(slotBtn.closest('[data-cbb-slot]'));
        return;
      }
      const tab = event.target.closest('[data-cbb-tab]');
      if (tab) {
        this.selectTab(tab.dataset.cbbTab);
        return;
      }
      const add = event.target.closest('[data-cbb-add]');
      if (add) {
        this.addToCart(add.closest('[data-cbb-bundle]'), add);
      }
    }

    onKeydown(event) {
      const tab = event.target.closest('[data-cbb-tab]');
      if (!tab || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
      const tabs = Array.from(this.querySelectorAll('[data-cbb-tab]'));
      const dir = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(tabs.indexOf(tab) + dir + tabs.length) % tabs.length];
      event.preventDefault();
      this.selectTab(next.dataset.cbbTab);
      next.focus();
    }

    togglePanel(toggle) {
      const panel = this.querySelector('[data-cbb-panel]');
      if (!panel) return;
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (open) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        panel.focus({ preventScroll: true });
      }
    }

    selectTab(name) {
      this.querySelectorAll('[data-cbb-tab]').forEach((tab) => {
        const active = tab.dataset.cbbTab === name;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      this.querySelectorAll('[data-cbb-tabpanel]').forEach((panel) => {
        panel.hidden = panel.dataset.cbbTabpanel !== name;
      });
    }

    // Tapping a product tile fills the next free slot of its role (ear clip or ear cuff).
    pickProduct(tile) {
      const bundle = tile.closest('[data-cbb-bundle]');
      if (!bundle || tile.disabled) return;
      const role = tile.dataset.role;
      const slots = Array.from(bundle.querySelectorAll(`[data-cbb-slot][data-role="${role}"]`));
      let slot = slots.find((s) => !s.dataset.productId);

      if (!slot) {
        if (role === 'cuff' && slots.length) {
          slot = slots[0]; // only one ear cuff: replace it
        } else {
          this.setMessage(bundle, this.dataset.textSlotsFull, true);
          return;
        }
      }

      this.setSlot(bundle, slot, tile.dataset.productId);
      this.setMessage(bundle, '');

      if (role === 'clip' && slots.every((s) => s.dataset.productId)) {
        const cuffSlot = bundle.querySelector('[data-cbb-slot][data-role="cuff"]');
        if (cuffSlot && !cuffSlot.dataset.productId) this.selectTab('cuff');
      }
      this.update(bundle);
    }

    onSlotClick(slot) {
      if (!slot) return;
      const bundle = slot.closest('[data-cbb-bundle]');
      if (slot.dataset.productId) {
        this.setSlot(bundle, slot, null);
        this.setMessage(bundle, '');
        this.update(bundle);
        return;
      }
      this.selectTab(slot.dataset.role);
      const panel = this.querySelector(`[data-cbb-tabpanel="${slot.dataset.role}"]`);
      const firstTile = panel && panel.querySelector('[data-cbb-pick]:not(:disabled)');
      if (firstTile) firstTile.focus();
    }

    setSlot(bundle, slot, productId) {
      const product = productId ? this.products[productId] : null;
      const label = slot.dataset.label || '';
      slot.dataset.productId = product ? String(productId) : '';
      slot.classList.toggle('is-filled', Boolean(product));

      const media = slot.querySelector('[data-cbb-slot-media]');
      if (media) {
        media.textContent = '';
        if (product && product.image) {
          const img = document.createElement('img');
          img.src = product.image;
          img.alt = '';
          img.width = 120;
          img.height = 120;
          img.loading = 'lazy';
          media.appendChild(img);
        } else {
          const plus = document.createElement('span');
          plus.className = 'cbb-slot__plus';
          plus.textContent = '+';
          media.appendChild(plus);
        }
      }

      const name = slot.querySelector('[data-cbb-slot-name]');
      if (name) name.textContent = product ? product.title : label;
      const hint = slot.querySelector('[data-cbb-slot-hint]');
      if (hint) {
        hint.textContent = product
          ? this.dataset.textRemove || ''
          : slot.dataset.role === 'cuff'
            ? this.dataset.textOptional || ''
            : this.dataset.textChoose || '';
      }
      const btn = slot.querySelector('[data-cbb-slot-btn]');
      if (btn) {
        btn.setAttribute(
          'aria-label',
          product
            ? (this.dataset.textAriaFilled || '').replace('[slot]', label).replace('[product]', product.title)
            : (this.dataset.textAriaEmpty || '').replace('[slot]', label)
        );
      }

      this.fillSlotVariants(slot, product);
      this.updateCounts(bundle);
    }

    fillSlotVariants(slot, product) {
      const wrapper = slot.querySelector('[data-cbb-slot-variant]');
      const select = slot.querySelector('[data-cbb-variant]');
      if (!select) return;
      select.textContent = '';
      if (!product) {
        if (wrapper) wrapper.hidden = true;
        return;
      }
      let selected = false;
      product.variants.forEach((v) => {
        const option = document.createElement('option');
        option.value = v.id;
        option.textContent = v.available ? v.title : `${v.title} – ${this.dataset.textSoldOut}`;
        option.disabled = !v.available;
        if (v.available && !selected) {
          option.selected = true;
          selected = true;
        }
        select.appendChild(option);
      });
      if (wrapper) wrapper.hidden = product.variants.length < 2;
    }

    // Show how often each product is in the set (e.g. the same ear clip twice).
    updateCounts(bundle) {
      const counts = {};
      bundle.querySelectorAll('[data-cbb-slot]').forEach((slot) => {
        const id = slot.dataset.productId;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      bundle.querySelectorAll('[data-cbb-pick]').forEach((tile) => {
        const count = counts[tile.dataset.productId] || 0;
        tile.setAttribute('aria-pressed', String(count > 0));
        const badge = tile.querySelector('[data-cbb-count]');
        if (badge) {
          badge.textContent = count > 1 ? `${count}×` : count === 1 ? '✓' : '';
          badge.hidden = count === 0;
        }
      });
    }

    getItems(bundle) {
      const items = [];
      bundle.querySelectorAll('[data-cbb-item]').forEach((itemEl) => {
        const input = itemEl.querySelector('[data-cbb-variant]');
        const id = input ? parseInt(input.value, 10) : NaN;
        const variant = this.variants[id];
        if (!variant) return;
        items.push({ id, role: itemEl.dataset.role, variant });
      });
      return items;
    }

    calculate(items) {
      const clips = items.filter((i) => i.role === 'clip');
      const clipDiscountActive = clips.length >= this.minClips;
      let compare = 0;
      let total = 0;
      items.forEach((item) => {
        const price = item.variant.price;
        // Compare-at prices (e.g. ear cuffs on sale) count as the regular price in the preview.
        const compareAt = Math.max(item.variant.compare_at_price || 0, price);
        // The automatic ear clip discount is applied on top of the current price in the cart.
        const pct = item.role === 'clip' && clipDiscountActive ? this.clipDiscount : 0;
        compare += compareAt;
        total += Math.round(price * (1 - pct / 100));
      });
      return { compare, total, saving: compare - total, clipCount: clips.length };
    }

    update(bundle) {
      const items = this.getItems(bundle);
      const result = this.calculate(items);
      const isCustom = bundle.hasAttribute('data-cbb-custom');

      const compareEl = bundle.querySelector('[data-cbb-compare]');
      const totalEl = bundle.querySelector('[data-cbb-total]');
      const savingEl = bundle.querySelector('[data-cbb-saving]');
      const addBtn = bundle.querySelector('[data-cbb-add]');

      if (totalEl) totalEl.textContent = items.length ? this.formatMoney(result.total) : '';
      if (compareEl) compareEl.textContent = result.saving > 0 ? this.formatMoney(result.compare) : '';
      if (savingEl) {
        savingEl.textContent =
          result.saving > 0 ? (this.dataset.textSave || '').replace('[amount]', this.formatMoney(result.saving)) : '';
      }

      const allAvailable = items.every((i) => i.variant.available);
      const complete = isCustom ? result.clipCount >= this.minClips : items.length > 0;
      if (addBtn) addBtn.setAttribute('aria-disabled', String(!(complete && allAvailable)));

      if (isCustom) this.renderSummary(bundle, items);
    }

    renderSummary(bundle, items) {
      const progress = bundle.querySelector('[data-cbb-progress]');
      if (progress) {
        const chosen = Math.min(items.filter((i) => i.role === 'clip').length, this.minClips);
        progress.textContent = (this.dataset.textProgress || '').replace('[chosen]', String(chosen));
      }
      const list = bundle.querySelector('[data-cbb-summary]');
      if (!list) return;
      list.innerHTML = '';
      items.forEach((item) => {
        const li = document.createElement('li');
        const variantTitle = item.variant.title && item.variant.title !== 'Default Title' ? ` (${item.variant.title})` : '';
        li.textContent = `${item.variant.productTitle}${variantTitle}`;
        list.appendChild(li);
      });
      const hasCuffSlot = bundle.querySelector('[data-cbb-slot][data-role="cuff"]');
      if (hasCuffSlot && !items.some((i) => i.role === 'cuff')) {
        const li = document.createElement('li');
        li.textContent = this.dataset.textNoCuff || '';
        li.style.opacity = '0.7';
        list.appendChild(li);
      }
    }

    setMessage(bundle, text, isError) {
      const msg = bundle && bundle.querySelector('[data-cbb-msg]');
      if (!msg) return;
      msg.textContent = text;
      msg.classList.toggle('cbb-msg--error', Boolean(isError));
    }

    async addToCart(bundle, button) {
      if (!bundle || button.getAttribute('aria-busy') === 'true') return;

      const items = this.getItems(bundle);
      const isCustom = bundle.hasAttribute('data-cbb-custom');
      const result = this.calculate(items);

      if (button.getAttribute('aria-disabled') === 'true') {
        if (isCustom && result.clipCount < this.minClips) {
          this.setMessage(bundle, this.dataset.textSelectClips, true);
        }
        return;
      }

      // Merge identical variants (e.g. the same ear clip chosen twice).
      const merged = {};
      items.forEach((item) => {
        merged[item.id] = (merged[item.id] || 0) + 1;
      });
      const payload = { items: Object.keys(merged).map((id) => ({ id: parseInt(id, 10), quantity: merged[id] })) };

      const cartHelper = this.getStore('xCartHelper');
      const sectionsToRender =
        cartHelper && typeof cartHelper.getSectionsToRender === 'function' ? cartHelper.getSectionsToRender() : [];
      if (sectionsToRender.length) payload.sections = sectionsToRender.map((s) => s.id);

      button.setAttribute('aria-busy', 'true');
      this.setMessage(bundle, '');

      try {
        const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const response = await fetch(this.dataset.cartAddUrl ? `${this.dataset.cartAddUrl}.js` : `${root}cart/add.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (!response.ok || data.status) {
          this.setMessage(bundle, data.description || data.message || this.dataset.textError, true);
          return;
        }

        this.setMessage(bundle, this.dataset.textAdded);
        this.refreshCart(data, sectionsToRender);
      } catch (error) {
        this.setMessage(bundle, this.dataset.textError, true);
      } finally {
        button.removeAttribute('aria-busy');
      }
    }

    refreshCart(data, sectionsToRender) {
      const miniCart = this.getStore('xMiniCart');
      const cartHelper = this.getStore('xCartHelper');

      // No theme cart stores available: fall back to the cart page.
      if (!miniCart || !data.sections) {
        window.location.href = this.dataset.cartUrl || '/cart';
        return;
      }

      sectionsToRender.forEach((section) => {
        const html = data.sections[section.id];
        if (!html) return;
        section.selector.split(',').forEach((selector) => {
          const el = document.querySelector(selector);
          if (!el) return;
          // getSectionInnerHTML is a top-level const in the theme's theme.js (global lexical scope, not on window).
          el.innerHTML =
            typeof getSectionInnerHTML === 'function'
              ? getSectionInnerHTML(html, selector)
              : this.sectionInnerHTML(html, selector);
        });
      });

      const cartNoti = this.getStore('xCartNoti');
      if (cartNoti && cartNoti.enable && typeof cartNoti.setItem === 'function') {
        cartNoti.setItem(data);
      } else if (typeof miniCart.openCart === 'function') {
        miniCart.openCart();
        document.dispatchEvent(new CustomEvent('eurus:cart:redirect'));
      }

      const bubble = document.querySelector('#cart-icon-bubble span');
      if (cartHelper && bubble) cartHelper.currentItemCount = parseInt(bubble.innerHTML, 10) || 0;
      document.dispatchEvent(new CustomEvent('eurus:cart:items-changed'));
      if (cartHelper && typeof cartHelper.updateEstimateShippingFull === 'function') {
        cartHelper.updateEstimateShippingFull();
      }
    }

    sectionInnerHTML(html, selector) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const el = doc.querySelector(selector) || doc.querySelector('.shopify-section');
      return el ? el.innerHTML : '';
    }

    getStore(name) {
      try {
        return window.Alpine && typeof window.Alpine.store === 'function' ? window.Alpine.store(name) : null;
      } catch (e) {
        return null;
      }
    }

    formatMoney(cents) {
      const helper = this.getStore('xHelper');
      if (helper && typeof helper.formatMoney === 'function') {
        return helper.formatMoney(cents, this.moneyFormat);
      }
      const amount = (cents / 100).toFixed(2);
      const [whole, decimals] = amount.split('.');
      const formatted = {
        amount: `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimals}`,
        amount_no_decimals: whole.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
        amount_with_comma_separator: `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimals}`,
        amount_no_decimals_with_comma_separator: whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      };
      return this.moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/, (match, key) => formatted[key] || formatted.amount);
    }
  }

  window.customElements.define('clyps-bundle-builder', ClypsBundleBuilder);
})();
