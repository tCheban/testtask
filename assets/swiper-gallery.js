class SwiperGallery extends HTMLElement {
  constructor() {
    super();
    this.swiperContainer = this.querySelector('.swiper-gallery');
    this.swiperWrapper = this.querySelector('.swiper-wrapper');
    this.pagination = this.querySelector('.swiper-pagination');
    this.prevButton = this.querySelector('.swiper-button-prev');
    this.nextButton = this.querySelector('.swiper-button-next');
    // Get settings from data attributes
    this.settings = {
      desktop: {
        slidesPerView: parseInt(this.dataset.desktopSlides) || 1,
        spaceBetween: parseInt(this.dataset.desktopSpace) || 20
      },
      tablet: {
        slidesPerView: parseInt(this.dataset.tabletSlides) || 1,
        spaceBetween: parseInt(this.dataset.tabletSpace) || 15
      },
      mobile: {
        slidesPerView: parseInt(this.dataset.mobileSlides) || 1,
        spaceBetween: parseInt(this.dataset.mobileSpace) || 10
      },
      enablePagination: this.dataset.enablePagination === 'true',
      enableNavigation: this.dataset.enableNavigation === 'true'
    };
    this.currentIndex = 0;
    this.currentVariantId = null;
    this.isFiltering = false;
    this.refreshSlides();
    this.init();
    this.setupThumbnailIntegration();
    this.setupVariantFiltering();
  }
  refreshSlides() {
    this.slides = this.querySelectorAll('.swiper-slide');
    this.allSlides = Array.from(this.slides);
    this.totalSlides = this.slides.length;
    this.currentSlidesPerView = this.getCurrentSlidesPerView();
    this.currentSpaceBetween = this.getCurrentSpaceBetween();
  }
  init() {
    // Refresh slides count before initialization
    this.refreshSlides();
    if (this.totalSlides === 0) {
      return;
    }
    this.setupEventListeners();
    this.updatePagination();
    this.updateNavigation();
    this.updateLayout();
    this.handleResize();
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  // Method to update gallery when slides are added dynamically
  updateGallery() {
    this.refreshSlides();
    this.updatePagination();
    this.updateNavigation();
    this.updateLayout();
    if (this.currentIndex >= this.totalSlides) {
      this.currentIndex = 0;
      this.updateTransform();
    }
  }
  setupThumbnailIntegration() {
    // Find thumbnail list
    const mediaGallery = this.closest('media-gallery');
    if (mediaGallery) {
      const thumbnailButtons = mediaGallery.querySelectorAll('.thumbnail-list button');
      thumbnailButtons.forEach((button, index) => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = button.closest('[data-target]')?.dataset.target;
          const variantId = button.closest('[data-variant-id]')?.dataset.variantId;
          if (targetId) {
            let slideIndex = -1;
            // For variant images, find by both media-id and variant-id
            if (variantId) {
              slideIndex = Array.from(this.slides).findIndex(slide => 
                slide.dataset.mediaId === targetId && slide.dataset.variantId === variantId
              );
            } else {
              // For regular media, find by media-id
              slideIndex = Array.from(this.slides).findIndex(slide => 
                slide.dataset.mediaId === targetId
              );
            }
            if (slideIndex !== -1) {
              this.slideTo(slideIndex);
              // Trigger variant selection if it's a variant image
              if (variantId) {
                this.handleVariantImageClick(variantId, button);
              }
            }
          }
        });
      });
      // Update thumbnail active state when swiper changes
      this.addEventListener('slideChanged', (e) => {
        const currentSlide = e.detail.currentSlide;
        const mediaId = currentSlide?.dataset.mediaId;
        const variantId = currentSlide?.dataset.variantId;
        if (mediaId) {
          // Remove active state from all thumbnails
          thumbnailButtons.forEach(btn => {
            btn.removeAttribute('aria-current');
            btn.closest('.thumbnail-list__item')?.classList.remove('active');
          });
          // Add active state to current thumbnail
          let currentThumbnail;
          if (variantId) {
            currentThumbnail = mediaGallery.querySelector(`[data-target="${mediaId}"][data-variant-id="${variantId}"] button`);
          } else {
            currentThumbnail = mediaGallery.querySelector(`[data-target="${mediaId}"] button`);
          }
          if (currentThumbnail) {
            currentThumbnail.setAttribute('aria-current', 'true');
            currentThumbnail.closest('.thumbnail-list__item')?.classList.add('active');
          }
        }
      });
    }
  }
  // Handle variant image clicks for potential integration with variant selector
  handleVariantImageClick(variantId, thumbnailButton) {
    // Dispatch custom event for variant selection integration
    const variantSelectEvent = new CustomEvent('variantImageClicked', {
      detail: {
        variantId: variantId,
        thumbnailButton: thumbnailButton
      },
      bubbles: true
    });
    this.dispatchEvent(variantSelectEvent);
    // Add visual feedback for variant selection
    const thumbnailItem = thumbnailButton.closest('.thumbnail-list__item');
    if (thumbnailItem && thumbnailItem.classList.contains('thumbnail-list_item--variant-color')) {
      thumbnailItem.style.transform = 'scale(0.95)';
      setTimeout(() => {
        thumbnailItem.style.transform = '';
      }, 150);
    }
  }
  getCurrentSlidesPerView() {
    const width = window.innerWidth;
    if (width >= 990) {
      return this.settings.desktop.slidesPerView;
    } else if (width >= 750) {
      return this.settings.tablet.slidesPerView;
    } else {
      return this.settings.mobile.slidesPerView;
    }
  }
  getCurrentSpaceBetween() {
    const width = window.innerWidth;
    if (width >= 990) {
      return this.settings.desktop.spaceBetween;
    } else if (width >= 750) {
      return this.settings.tablet.spaceBetween;
    } else {
      return this.settings.mobile.spaceBetween;
    }
  }
  setupEventListeners() {
    if (this.prevButton && this.settings.enableNavigation) {
      this.prevButton.addEventListener('click', () => this.slidePrev());
      this.prevButton.setAttribute('aria-label', 'Previous slide');
      this.prevButton.setAttribute('role', 'button');
      this.prevButton.setAttribute('tabindex', '0');
    }
    if (this.nextButton && this.settings.enableNavigation) {
      this.nextButton.addEventListener('click', () => this.slideNext());
      this.nextButton.setAttribute('aria-label', 'Next slide');
      this.nextButton.setAttribute('role', 'button');
      this.nextButton.setAttribute('tabindex', '0');
    }
    // Keyboard navigation
    this.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.slidePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.slideNext();
      }
    });
    // Touch events for mobile
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    this.swiperContainer.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
    });
    this.swiperContainer.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      e.preventDefault();
    });
    this.swiperContainer.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      const deltaX = startX - currentX;
      const threshold = 50;
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          this.slideNext();
        } else {
          this.slidePrev();
        }
      }
    });
  }
  updateLayout() {
    const slideWidth = (100 - (this.currentSlidesPerView - 1) * (this.currentSpaceBetween / this.swiperContainer.clientWidth * 100)) / this.currentSlidesPerView;
    this.slides.forEach((slide, index) => {
      slide.style.width = `${slideWidth}%`;
      slide.style.marginRight = index < this.slides.length - 1 ? `${this.currentSpaceBetween}px` : '0';
    });
    this.updateTransform();
  }
  updateTransform() {
    const slideWidth = this.slides[0] ? this.slides[0].offsetWidth : 0;
    const spacing = this.currentSpaceBetween;
    const translateX = -(this.currentIndex * (slideWidth + spacing));
    this.swiperWrapper.style.transform = `translate3d(${translateX}px, 0, 0)`;
    this.swiperWrapper.style.transition = 'transform 0.3s ease';
  }
  slideNext() {
    const maxIndex = Math.max(0, this.totalSlides - this.currentSlidesPerView);
    if (this.currentIndex < maxIndex) {
      this.currentIndex++;
      this.updateTransform();
      this.updatePagination();
      this.updateNavigation();
      this.dispatchSlideChangeEvent();
    }
  }
  slidePrev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateTransform();
      this.updatePagination();
      this.updateNavigation();
      this.dispatchSlideChangeEvent();
    }
  }
  slideTo(index) {
    const maxIndex = Math.max(0, this.totalSlides - this.currentSlidesPerView);
    this.currentIndex = Math.max(0, Math.min(index, maxIndex));
    this.updateTransform();
    this.updatePagination();
    this.updateNavigation();
    this.dispatchSlideChangeEvent();
  }
  updatePagination() {
    if (!this.pagination) return;
    // Hide/show pagination based on settings
    if (!this.settings.enablePagination) {
      this.pagination.classList.add('swiper-pagination-hidden');
      return;
    }
    // Clear existing pagination
    this.pagination.innerHTML = '';
    const totalPages = Math.max(1, this.totalSlides - this.currentSlidesPerView + 1);
    // Hide pagination if only one page
    if (totalPages <= 1) {
      this.pagination.classList.add('swiper-pagination-hidden');
      return;
    }
    // Show pagination
    this.pagination.classList.remove('swiper-pagination-hidden');
    for (let i = 0; i < totalPages; i++) {
      const bullet = document.createElement('span');
      bullet.className = `swiper-pagination-bullet ${i === this.currentIndex ? 'swiper-pagination-bullet-active' : ''}`;
      bullet.addEventListener('click', () => this.slideTo(i));
      bullet.setAttribute('aria-label', `Go to slide ${i + 1}`);
      bullet.setAttribute('role', 'button');
      bullet.setAttribute('tabindex', '0');
      // Add keyboard support
      bullet.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.slideTo(i);
        }
      });
      this.pagination.appendChild(bullet);
    }
  }
  updateNavigation() {
    if (!this.prevButton || !this.nextButton) return;
    const maxIndex = Math.max(0, this.totalSlides - this.currentSlidesPerView);
    // Hide/show navigation based on settings
    if (!this.settings.enableNavigation) {
      this.prevButton.classList.add('swiper-button-hidden');
      this.nextButton.classList.add('swiper-button-hidden');
      return;
    }
    // Hide navigation if not enough slides
    if (this.totalSlides <= this.currentSlidesPerView) {
      this.prevButton.classList.add('swiper-button-hidden');
      this.nextButton.classList.add('swiper-button-hidden');
      return;
    }
    // Show navigation
    this.prevButton.classList.remove('swiper-button-hidden');
    this.nextButton.classList.remove('swiper-button-hidden');
    // Update disabled states
    if (this.currentIndex <= 0) {
      this.prevButton.classList.add('swiper-button-disabled');
    } else {
      this.prevButton.classList.remove('swiper-button-disabled');
    }
    if (this.currentIndex >= maxIndex) {
      this.nextButton.classList.add('swiper-button-disabled');
    } else {
      this.nextButton.classList.remove('swiper-button-disabled');
    }
  }
  handleResize() {
    const newSlidesPerView = this.getCurrentSlidesPerView();
    const newSpaceBetween = this.getCurrentSpaceBetween();
    if (newSlidesPerView !== this.currentSlidesPerView || newSpaceBetween !== this.currentSpaceBetween) {
      this.currentSlidesPerView = newSlidesPerView;
      this.currentSpaceBetween = newSpaceBetween;
      // Adjust current index if needed
      const maxIndex = Math.max(0, this.totalSlides - this.currentSlidesPerView);
      if (this.currentIndex > maxIndex) {
        this.currentIndex = maxIndex;
      }
      this.updateLayout();
      this.updatePagination();
      this.updateNavigation();
    }
  }
  dispatchSlideChangeEvent() {
    const event = new CustomEvent('slideChanged', {
      detail: {
        currentIndex: this.currentIndex,
        currentSlide: this.slides[this.currentIndex],
        slidesPerView: this.currentSlidesPerView
      }
    });
    this.dispatchEvent(event);
  }
  setupVariantFiltering() {
    document.addEventListener('shopify:variant:change', (event) => {
      if (event.detail && event.detail.variant) {
        this.filterByVariant(event.detail.variant.id);
      }
    });
    // Listen for PUB_SUB variant option changes
    if (typeof subscribe !== 'undefined' && window.PUB_SUB_EVENTS?.optionValueSelectionChange) {
      subscribe(window.PUB_SUB_EVENTS.optionValueSelectionChange, (data) => {
        this.handleVariantOptionChange(data);
      });
    }
    // Listen for direct variant selector changes
    const variantSelects = document.querySelector('variant-selects');
    if (variantSelects) {
      variantSelects.addEventListener('change', () => {
        setTimeout(() => {
          this.updateFromVariantSelects();
        }, 50);
      });
    }
    // Initialize with current variant if any
    this.initializeWithCurrentVariant();
  }
  initializeWithCurrentVariant() {
    const variantSelects = document.querySelector('variant-selects');
    const selectedVariantData = variantSelects?.querySelector('[data-selected-variant]');
    if (selectedVariantData) {
      try {
        const variant = JSON.parse(selectedVariantData.innerHTML);
        if (variant && variant.id) {
          // Check if this variant has specific images
          const variantSlides = this.allSlides.filter(slide => {
            const slideVariantId = slide.dataset.variantId;
            return slideVariantId && parseInt(slideVariantId) === parseInt(variant.id);
          });
          // Only filter if variant has specific images
          if (variantSlides.length > 0) {
            this.filterByVariant(variant.id);
          }
        }
      } catch (e) {
      }
    }
  }
  handleVariantOptionChange(data) {
    if (!data || !data.selectedOptionValues) return;
    // Find variant that matches selected options
    const productData = this.getProductData();
    if (productData && productData.variants) {
      const matchingVariant = productData.variants.find(variant => {
        return data.selectedOptionValues.every(optionValueId => {
          return variant.option_values?.some(value => value.id === parseInt(optionValueId));
        });
      });
      if (matchingVariant) {
        this.filterByVariant(matchingVariant.id);
      }
    }
  }
  updateFromVariantSelects() {
    const variantSelects = document.querySelector('variant-selects');
    const selectedVariantData = variantSelects?.querySelector('[data-selected-variant]');
    if (selectedVariantData) {
      try {
        const variant = JSON.parse(selectedVariantData.innerHTML);
        if (variant && variant.id) {
          this.filterByVariant(variant.id);
        }
      } catch (e) {
      }
    }
  }
  getProductData() {
    const productJson = document.querySelector('#ProductJSON-product, [data-product-json]');
    if (productJson) {
      try {
        return JSON.parse(productJson.innerHTML);
      } catch (e) {
      }
    }
    return null;
  }
  filterByVariant(variantId) {
    const productScript = document.querySelector(`script[id*="ProductJSON"]`);
    if (!productScript) {
      return;
    }
    try {
      const productData = JSON.parse(productScript.textContent);
      const variant = productData.variants.find(v => v.id == variantId);
      if (!variant) {
        return;
      }
      const container = this.querySelector('#swiper-slides-container');
      if (!container) {
        return;
      }
      container.innerHTML = '';
      if (variant.images && variant.images.length > 0) {
        variant.images.forEach((imageUrl, index) => {
          let fixedImageUrl = imageUrl;
          if (imageUrl.startsWith('//')) {
            fixedImageUrl = 'https:' + imageUrl;
          }
          const slide = document.createElement('div');
          slide.className = 'swiper-slide';
          slide.setAttribute('data-variant-id', variantId);
          slide.innerHTML = `
            <div class="media media--transparent media--adapt media--height-adapt product__media-item">
              <img 
                src="${fixedImageUrl}"
                alt="${variant.title}"
                class="motion-reduce variant-image"
                style="width: 100%; height: auto; object-fit: cover;"
                ${index > 0 ? 'loading="lazy"' : ''}
              >
            </div>
          `;
          container.appendChild(slide);
        });
        // Refresh slides collection
        this.refreshSlides();
        // Force reset gallery state
        this.currentIndex = 0;
        // Update responsive settings
        this.handleResize();
        // Reinitialize gallery components
        this.updatePagination();
        this.updateNavigation();
        this.updateLayout();
        // Force transform update
        this.updateTransform();
      } else {
        return;
      }
    } catch (e) {
    }
  }
  showAllSlides() {
    this.currentVariantId = null;
    this.isFiltering = true;
    // Add filtering class for animation
    this.swiperContainer.classList.add('variant-filtering');
    setTimeout(() => {
      // Show all slides with staggered animation
      this.allSlides.forEach((slide, index) => {
        setTimeout(() => {
          slide.style.display = 'block';
          slide.classList.remove('slide-hidden');
        }, index * 30);
      });
      // Reset slides collection
      this.slides = this.allSlides;
      this.totalSlides = this.slides.length;
      this.currentIndex = 0;
      // Update layout and navigation after animation
      setTimeout(() => {
        this.updateLayout();
        this.updatePagination();
        this.updateNavigation();
        this.swiperContainer.classList.remove('variant-filtering');
      }, this.allSlides.length * 30 + 100);
      // Show all thumbnails
      this.showAllThumbnails();
    }, 100);
    this.isFiltering = false;
  }
  filterThumbnails(variantId) {
    const thumbnailSlider = document.querySelector('#GalleryThumbnails-' + this.closest('media-gallery').id.split('-')[1]);
    if (!thumbnailSlider) return;
    const thumbnails = thumbnailSlider.querySelectorAll('.thumbnail-list__item');
    thumbnails.forEach(thumbnail => {
      const thumbnailVariantId = thumbnail.dataset.variantId;
      // Show only thumbnails that match this variant
      if (thumbnailVariantId && parseInt(thumbnailVariantId) === parseInt(variantId)) {
        thumbnail.style.display = 'block';
        thumbnail.classList.remove('thumbnail-hidden');
      } else {
        // Hide all other thumbnails (including product images)
        thumbnail.style.display = 'none';
        thumbnail.classList.add('thumbnail-hidden');
      }
    });
    // Update thumbnail slider if it exists
    if (thumbnailSlider.resetPages && typeof thumbnailSlider.resetPages === 'function') {
      thumbnailSlider.resetPages();
    }
  }
  showAllThumbnails() {
    const thumbnailSlider = document.querySelector('#GalleryThumbnails-' + this.closest('media-gallery').id.split('-')[1]);
    if (!thumbnailSlider) return;
    const thumbnails = thumbnailSlider.querySelectorAll('.thumbnail-list__item');
    thumbnails.forEach(thumbnail => {
      thumbnail.style.display = 'block';
      thumbnail.classList.remove('thumbnail-hidden');
    });
    // Update thumbnail slider if it exists
    if (thumbnailSlider.resetPages && typeof thumbnailSlider.resetPages === 'function') {
      thumbnailSlider.resetPages();
    }
  }
}
// Register the custom element
if (!customElements.get('swiper-gallery')) {
  customElements.define('swiper-gallery', SwiperGallery);
} else {
}
// Initialize or update galleries after DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Find all swiper galleries and update them
  const galleries = document.querySelectorAll('swiper-gallery');
  galleries.forEach(gallery => {
    if (gallery.updateGallery) {
      gallery.updateGallery();
    }
  });
});
// Also update when the page is fully loaded (including images)
window.addEventListener('load', function() {
  const galleries = document.querySelectorAll('swiper-gallery');
  galleries.forEach(gallery => {
    if (gallery.updateGallery) {
      gallery.updateGallery();
    }
  });
});
