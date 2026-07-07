import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, where, getDocs, updateDoc, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDkW8QBHruMzQztReP3XmGU5sz8MwSlYEU",
    authDomain: "rd-catalog.firebaseapp.com",
    databaseURL: "https://rd-catalog-default-rtdb.firebaseio.com",
    projectId: "rd-catalog",
    storageBucket: "rd-catalog.firebasestorage.app",
    messagingSenderId: "194426515298",
    appId: "1:194426515298:web:9d572c86a9c80b9fcc463b",
    measurementId: "G-DXJ5KQ0RZS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
auth.useDeviceLanguage();

const mainContainer = document.getElementById('catalog-main');

let cart = [];
let allProducts = [];
let productsByCategory = {};
let selectedCategory = "All";

// 🎟️ Coupons State
let availableCoupons = [];

function listenCoupons() {
    onSnapshot(collection(db, "coupons"), (snapshot) => {
        availableCoupons = [];
        snapshot.forEach(docSnap => {
            if (docSnap.data().isActive) {
                availableCoupons.push({ id: docSnap.id, ...docSnap.data() });
            }
        });
    });
}



// 🌟 SMART LOGIN SYSTEM
let loggedInUser = localStorage.getItem('customerMobile') || null;
let currentLoginIntent = 'checkout';

// ==========================================
// 👕 1. CATALOG & PRODUCTS LOGIC
// ==========================================

function listenProducts() {
    onSnapshot(collection(db, "products"), (querySnapshot) => {
        productsByCategory = {};
        allProducts = [];

        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id;
            allProducts.push(data);

            let catName = data.mainCategory || "Uncategorized";

            if (!productsByCategory[catName]) {
                productsByCategory[catName] = [];
            }
            productsByCategory[catName].push(data);
        });

        if (allProducts.length === 0) {
            mainContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Koi product nahi mila.</p>';
            document.getElementById('category-nav').innerHTML = '';
            document.getElementById('sub-category-nav').classList.add('hidden');
        } else {
            renderCategoryNav();
            renderCatalog();
        }
    });
}

function renderCategoryNav() {
    const navContainer = document.getElementById('category-nav');
    navContainer.innerHTML = '';
    const categories = ["All", ...Object.keys(productsByCategory)];

    if (!categories.includes(selectedCategory)) {
        selectedCategory = "All";
    }

    categories.forEach(cat => {
        let btn = document.createElement('button');
        btn.classList.add('category-tab');
        if (cat === selectedCategory) btn.classList.add('active');
        btn.innerText = cat;
        btn.onclick = () => {
            selectedCategory = cat;
            renderCategoryNav();
            renderCatalog();
        };
        navContainer.appendChild(btn);
    });
}

function renderSubCategoryNav(productsGroupedBySub, subCatsArray) {
    const subNavContainer = document.getElementById('sub-category-nav');
    if (selectedCategory === "All" || subCatsArray.length === 0) {
        subNavContainer.classList.add('hidden');
        return;
    }

    subNavContainer.classList.remove('hidden');
    subNavContainer.innerHTML = '';

    subCatsArray.forEach((sub, index) => {
        let cleanSubId = sub.replace(/\s+/g, '-');
        let subImg = productsGroupedBySub[sub][0].img;
        let btn = document.createElement('button');
        btn.classList.add('sub-category-tab');
        btn.id = `tab-${cleanSubId}`;

        btn.innerHTML = `
            <div class="sub-cat-img-wrapper"><img src="${subImg}" alt="${sub}"></div>
            <span class="sub-cat-name">${sub}</span>
        `;
        if (index === 0) btn.classList.add('active');

        btn.onclick = () => {
            document.getElementById(`section-${cleanSubId}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        subNavContainer.appendChild(btn);
    });
}

function setupIntersectionObserver() {
    const sections = document.querySelectorAll('.category-section');
    const observerOptions = { root: null, rootMargin: '-120px 0px -50% 0px', threshold: 0 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const subName = entry.target.id.replace('section-', '');
                document.querySelectorAll('.sub-category-tab').forEach(tab => tab.classList.remove('active'));
                const activeTab = document.getElementById(`tab-${subName}`);
                if (activeTab) {
                    activeTab.classList.add('active');
                    activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }, observerOptions);
    sections.forEach(section => observer.observe(section));
}

function renderCatalog() {
    mainContainer.innerHTML = '';

    if (selectedCategory === "All") {
        document.getElementById('sub-category-nav').classList.add('hidden');
        for (const [categoryName, products] of Object.entries(productsByCategory)) {
            let section = document.createElement('div');
            section.classList.add('category-section');
            section.innerHTML += `<div class="category-header"><h3>${categoryName}</h3></div>`;
            products.forEach(product => { section.appendChild(window.createProductItem(product)); });
            mainContainer.appendChild(section);
        }
    } else {
        let productsInMainCat = productsByCategory[selectedCategory] || [];
        let subCatsSet = new Set();
        let productsGroupedBySub = {};

        productsInMainCat.forEach(p => {
            let sub = p.subCategory && p.subCategory.trim() !== "" ? p.subCategory : "Others";
            subCatsSet.add(sub);
            if (!productsGroupedBySub[sub]) productsGroupedBySub[sub] = [];
            productsGroupedBySub[sub].push(p);
        });

        let subCatsArray = Array.from(subCatsSet);
        renderSubCategoryNav(productsGroupedBySub, subCatsArray);

        subCatsArray.forEach(sub => {
            let cleanSubId = sub.replace(/\s+/g, '-');
            let section = document.createElement('div');
            section.classList.add('category-section');
            section.id = `section-${cleanSubId}`;
            section.innerHTML += `<div class="category-header"><h3 style="color:#128c7e;">${sub}</h3></div>`;
            productsGroupedBySub[sub].forEach(product => { section.appendChild(window.createProductItem(product)); });
            mainContainer.appendChild(section);
        });
        setupIntersectionObserver();
    }
}

window.createProductItem = function (product) {
    let div = document.createElement('div');
    div.classList.add('product-item');
    const cartItem = cart.find(item => item.id === product.id);
    let actionHTML = '';

    // 🌟 Check if Out of Stock
    if (product.stockQty !== undefined && product.stockQty <= 0) {
        actionHTML = `<span style="color:#dc3545; font-weight:bold; font-size:13px; padding: 6px 15px; background: #fff0f0; border-radius: 6px;">Out of Stock</span>`;
    } else if (cartItem) {
        actionHTML = `<div class="qty-controls"><button class="btn-qty" onclick="window.decreaseQuantity('${product.id}')">-</button><span class="qty-count">${cartItem.quantity}</span><button class="btn-qty" onclick="window.addToCart('${product.id}')">+</button></div>`;
    } else {
        actionHTML = `<button class="btn-add" onclick="window.addToCart('${product.id}')">ADD</button>`;
    }

    div.innerHTML = `
        <img src="${product.img}" alt="Product" class="product-img" style="cursor:pointer;" onclick="window.openPDP('${product.id}')">
        <div class="product-info">
            <h4 class="product-title" style="cursor:pointer;" onclick="window.openPDP('${product.id}')">${product.name}</h4>
            <p class="product-desc">${product.desc}</p>
            <div class="price-container">
                <span class="current-price">₹${product.sellingPrice}</span>
                <span class="old-price"><strike>₹${product.mrp}</strike></span>
            </div>
        </div>
        <div id="action-${product.id}" class="action-container">${actionHTML}</div>
    `;
    return div;
}

// ==========================================
// 🛒 2. CART LOGIC
// ==========================================

window.addToCart = function (productId) {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        const existingItem = cart.find(item => item.id === productId);
        let currentQty = existingItem ? existingItem.quantity : 0;

        // 🌟 Limit and Stock Validation
        if (product.stockQty !== undefined && currentQty >= product.stockQty) {
            window.showToast(`Sorry, only ${product.stockQty} items left in stock!`, false);
            return;
        }
        if (product.maxPerOrder && product.maxPerOrder > 0 && currentQty >= product.maxPerOrder) {
            window.showToast(`Limit reached! You can only buy ${product.maxPerOrder} qty per order.`, false);
            return;
        }

        if (existingItem) { existingItem.quantity += 1; }
        else { cart.push({ ...product, quantity: 1 }); }
        updateProductActionUI(productId);
        updateCartUI(true);
    }
}

window.decreaseQuantity = function (productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        if (cart[itemIndex].quantity > 1) { cart[itemIndex].quantity -= 1; }
        else { cart.splice(itemIndex, 1); }
        updateProductActionUI(productId);
        updateCartUI(true);
    }
}

function updateProductActionUI(productId) {
    const actionDiv = document.getElementById(`action-${productId}`);
    if (!actionDiv) return;
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        actionDiv.innerHTML = `<div class="qty-controls"><button class="btn-qty" onclick="window.decreaseQuantity('${productId}')">-</button><span class="qty-count">${cartItem.quantity}</span><button class="btn-qty" onclick="window.addToCart('${productId}')">+</button></div>`;
    } else {
        actionDiv.innerHTML = `<button class="btn-add" onclick="window.addToCart('${productId}')">ADD</button>`;
    }
}

// let lastGiftEligibility = false;



function updateCartUI(showPopup = false) {
    // Naya Coupon Nudge system call karega (sirf cart modal me dikhega, screen par nahi)
    if (typeof window.evaluateCouponNudges === 'function') {
        window.evaluateCouponNudges();
    }

    const checkoutBar = document.getElementById('checkout-bar');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const modalCartTotal = document.getElementById('modal-cart-total');

    if (cart.length > 0) {
        let totalItems = 0, totalPrice = 0;
        cart.forEach(item => {
            totalItems += item.quantity;
            totalPrice += (parseFloat(item.sellingPrice) * item.quantity);
        });
        if (cartCount) cartCount.innerText = `${totalItems} Items`;
        if (cartTotal) cartTotal.innerText = `₹${totalPrice}`;
        if (modalCartTotal) modalCartTotal.innerText = `₹${totalPrice}`;
        if (checkoutBar) checkoutBar.classList.remove('hidden');
    } else {
        if (checkoutBar) checkoutBar.classList.add('hidden');
        const cartModal = document.getElementById('cart-modal');
        if (cartModal && !cartModal.classList.contains('hidden')) { closeCart(); }
    }

    const cartModal = document.getElementById('cart-modal');
    if (cartModal && !cartModal.classList.contains('hidden')) { renderCartItems(); }
}

window.openCart = function () {
    document.getElementById('cart-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderCartItems();
}

window.closeCart = function () {
    document.getElementById('cart-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    container.innerHTML = '';

    cart.forEach(item => {
        let div = document.createElement('div');
        div.classList.add('cart-item');

        let qtyControlsHtml = item.isFreeGift ?
            `<span style="color:#10b981; font-weight:bold; font-size:13px; padding: 5px 10px; background: #ecfdf5; border-radius: 4px;">FREE GIFT</span>` :
            `<div class="qty-controls">
                <button class="btn-qty" onclick="window.decreaseQuantity('${item.id}')">-</button>
                <span class="qty-count">${item.quantity}</span>
                <button class="btn-qty" onclick="window.addToCart('${item.id}')">+</button>
            </div>`;

        div.innerHTML = `
            <img src="${item.img}" alt="img" class="cart-item-img">
            <div class="cart-item-info">
                <div class="cart-item-title" style="${item.isFreeGift ? 'color:#065f46; font-weight:bold;' : ''}">${item.name}</div>
                <div class="cart-item-price">${item.isFreeGift ? '<strike>₹' + item.mrp + '</strike> ₹0' : '₹' + item.sellingPrice}</div>
            </div>
            ${qtyControlsHtml}
        `;
        container.appendChild(div);
    });
}

// ==========================================
// 🔐 3. FIREBASE OTP LOGIN & AUTH LOGIC
// ==========================================

let recaptchaWidgetId = null;

window.openLoginModal = function (intent = 'checkout') {
    currentLoginIntent = intent;
    if (loggedInUser) {
        if (intent === 'checkout') { openCheckoutPage(); }
        else { openProfile(); }
        return;
    }
    if (intent === 'checkout' && cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    resetLoginUI();
    document.getElementById('login-overlay').classList.add('active');

    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible'
        });
        window.recaptchaVerifier.render().then((widgetId) => {
            recaptchaWidgetId = widgetId;
        });
    } else if (recaptchaWidgetId !== null) {
        grecaptcha.reset(recaptchaWidgetId);
    }
}

window.closeLoginModal = function () {
    document.getElementById('login-overlay').classList.remove('active');
}

window.resetLoginUI = function () {
    document.getElementById('step1-phone').style.display = 'block';
    document.getElementById('step2-otp').style.display = 'none';
    document.getElementById('loginHelpText').innerText = "Please enter your 10-digit mobile number.";
    document.getElementById('mobileNumber').value = "";
    document.getElementById('otpInput').value = "";
}

window.sendOTP = function () {
    const mobile = document.getElementById('mobileNumber').value.trim();
    const btn = document.getElementById('sendOtpBtn');

    if (mobile.length !== 10) {
        alert("Please enter a valid 10-digit mobile number");
        return;
    }

    btn.innerText = "Sending OTP...";
    btn.disabled = true;

    const phoneNumber = "+91" + mobile;

    signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier)
        .then((confirmationResult) => {
            window.confirmationResult = confirmationResult;
            document.getElementById('step1-phone').style.display = 'none';
            document.getElementById('step2-otp').style.display = 'block';
            document.getElementById('loginHelpText').innerHTML = `OTP sent to <strong>+91 ${mobile}</strong>`;
            btn.innerText = "Send OTP";
            btn.disabled = false;
        }).catch((error) => {
            console.error("SMS not sent", error);
            alert("Firebase Error: " + error.code + "\n\n" + error.message);
            btn.innerText = "Send OTP";
            btn.disabled = false;
            if (recaptchaWidgetId !== null) {
                try { grecaptcha.reset(recaptchaWidgetId); } catch (e) { }
            }
        });
}

window.verifyOTP = async function () {
    const otpCode = document.getElementById('otpInput').value.trim();
    const btn = document.getElementById('verifyOtpBtn');
    const mobile = document.getElementById('mobileNumber').value.trim();

    if (otpCode.length !== 6) {
        alert("Please enter a valid 6-digit OTP.");
        return;
    }

    btn.innerText = "Verifying...";
    btn.disabled = true;

    try {
        const result = await window.confirmationResult.confirm(otpCode);

        await setDoc(doc(db, "customers", mobile), {
            mobileNumber: mobile,
            lastLogin: new Date().toISOString()
        }, { merge: true });

        loggedInUser = mobile;
        localStorage.setItem('customerMobile', mobile);

        closeLoginModal();
        btn.innerText = "Verify OTP & Login";
        btn.disabled = false;

        if (currentLoginIntent === 'checkout') {
            openCheckoutPage();
        } else if (currentLoginIntent === 'profile') {
            openProfile();
        }
    } catch (error) {
        console.error("OTP Verification failed", error);
        alert("Invalid OTP! Please enter the correct code.");
        btn.innerText = "Verify OTP & Login";
        btn.disabled = false;
    }
}

// ==========================================
// 💳 4. PREMIUM CHECKOUT LOGIC & PROMO CODES
// ==========================================

let checkoutState = {
    selectedAddressIndex: 0,
    paymentMethod: 'COD',
    couponCode: '',
    couponDiscount: 0
};

window.openCheckoutPage = function () {
    closeCart();
    document.getElementById('checkout-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderCheckoutPage();
}

window.closeCheckoutPage = function () {
    document.getElementById('checkout-modal').classList.add('hidden');
    document.body.style.overflow = '';
    openCart();
}
// 🌟 NAYA HELPER FUNCTION: List band karne aur smooth update ke liye
window.selectAddressAndRender = function (idx) {
    checkoutState.selectedAddressIndex = idx;

    // List ko turant close karo
    const addressList = document.getElementById('chk-body-address');
    if (addressList) addressList.classList.remove('active');

    // Page ko bina "Loading..." flash kiye smooth update karo
    window.renderCheckoutPage(true);
}

window.renderCheckoutPage = async function (isSilentUpdate = false) {
    const container = document.getElementById('checkout-content-container');

    // Agar silent update nahi hai, tabhi loading text dikhao
    if (!isSilentUpdate) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">Loading Secure Checkout...</p>';
    }

    let savedAddresses = [];
    try {
        const docSnap = await getDoc(doc(db, "customers", loggedInUser));
        if (docSnap.exists() && docSnap.data().addresses) {
            savedAddresses = docSnap.data().addresses;
        }
    } catch (e) { console.error("Error fetching addresses"); }

    let mrpTotal = 0;
    let sellingTotal = 0;
    let totalItems = 0;

    let orderSummaryHtml = '';
    cart.forEach(item => {
        let mrp = parseFloat(item.mrp) || parseFloat(item.sellingPrice);
        let sp = parseFloat(item.sellingPrice);
        mrpTotal += (mrp * item.quantity);
        sellingTotal += (sp * item.quantity);
        totalItems += item.quantity;

        orderSummaryHtml += `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <img src="${item.img}" style="width:50px; height:50px; border-radius:6px; border:1px solid #eee; object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:600; color:#222;">${item.name}</div>
                    <div style="font-size:12px; color:#555;">QTY: ${item.quantity}</div>
                </div>
                <div style="font-weight:700; font-size:14px;">₹${sp * item.quantity}</div>
            </div>
        `;
    });

    let itemDiscount = mrpTotal - sellingTotal;

    // 🌟 Promo Code Integrity Check
    if (checkoutState.couponCode !== '') {
        const appliedCpn = availableCoupons.find(c => c.code === checkoutState.couponCode);
        let eligibleTotal = 0;
        cart.forEach(item => { if (!item.isPromoGift && !item.isFreeGift) eligibleTotal += (parseFloat(item.sellingPrice) * item.quantity); });

        if (!appliedCpn || eligibleTotal < appliedCpn.minOrder) {
            window.removeCoupon(false);
            window.showToast("Cart value dropped below requirement. Promo removed automatically.", false);
        }
    }

    let finalAmount = sellingTotal - checkoutState.couponDiscount;

    let addressHtml = ``;
    let activeAddressDisplay = ``;

    if (savedAddresses.length > 0) {
        if (checkoutState.selectedAddressIndex >= savedAddresses.length) checkoutState.selectedAddressIndex = 0;
        let activeAddr = savedAddresses[checkoutState.selectedAddressIndex];

        if (typeof activeAddr === 'object') {
            activeAddressDisplay = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div style="font-size: 15px; color: #111; font-weight: bold;">Deliver to:</div>
                    <button onclick="toggleChkBody('chk-body-address')" style="background: #fff; border: 1px solid #d1d5db; padding: 6px 16px; border-radius: 4px; color: #2563eb; font-weight: 600; font-size: 13px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">Change</button>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <strong style="font-size: 16px; color: #111;">${activeAddr.fullName}</strong>
                    <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #555;">${(activeAddr.type || 'HOME').toUpperCase()}</span>
                </div>
                <div style="font-size: 14px; color: #444; line-height: 1.5; margin-bottom: 10px;">
                    ${activeAddr.building}, ${activeAddr.area}, ${activeAddr.city}, ${activeAddr.state} - ${activeAddr.pincode}
                </div>
                <div style="font-size: 15px; font-weight: 600; color: #111;">
                    ${activeAddr.mobile}
                </div>
            `;
        } else {
            activeAddressDisplay = `<div style="font-size: 14px; color: #444;">${activeAddr}</div>
            <button onclick="toggleChkBody('chk-body-address')" style="margin-top:10px; background: #fff; border: 1px solid #d1d5db; padding: 6px 16px; border-radius: 4px; color: #2563eb; font-weight: 600; font-size: 13px; cursor: pointer;">Change</button>`;
        }

        addressHtml += `<button style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; background:#fff; border:1px dashed #128c7e; color:#128c7e; font-weight:bold;" onclick="window.openNewAddressModal('checkout')">+ Add New Address</button>`;

        savedAddresses.forEach((addr, idx) => {
            let isChecked = idx === checkoutState.selectedAddressIndex ? 'checked' : '';
            let isSelectedClass = idx === checkoutState.selectedAddressIndex ? 'selected' : '';

            let addrText = typeof addr === 'object' ?
                `<strong style="color:#111;">${addr.fullName}</strong> <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; color: #555; margin-left: 5px;">${(addr.type || 'HOME').toUpperCase()}</span><br><div style="margin-top:4px;">${addr.building}, ${addr.area}, ${addr.city}, ${addr.state} - ${addr.pincode}</div>`
                : addr;

            // 🌟 NAYA FIX: onclick par event.preventDefault() aur naya helper function lagaya gaya hai
            addressHtml += `
                <label class="address-radio-label ${isSelectedClass}" style="position: relative; display: flex; align-items: flex-start; cursor: pointer;" onclick="event.preventDefault(); window.selectAddressAndRender(${idx});">
                    <div style="flex: 1;">
                        <div style="font-size:13px; color:#444; line-height:1.4;">${addrText}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; height: 100%;">
                        <input type="radio" name="addressSelect" class="radio-custom" ${isChecked} style="pointer-events: none;">
                        <span style="color:#2563eb; font-size:12px; font-weight:600; cursor:pointer; margin-top: 15px; padding: 4px;" onclick="event.stopPropagation(); window.editAddress(${idx}, 'checkout')">✏️ Edit</span>
                    </div>
                </label>
            `;
        });
    }

    let offerHeaderText = '';
    if (checkoutState.couponCode !== '') {
        offerHeaderText = `<span style="color:#10b981;">'${checkoutState.couponCode}' Applied ✅</span>`;
    } else if (availableCoupons.length > 0) {
        let plural = availableCoupons.length > 1 ? 's' : '';
        offerHeaderText = `${availableCoupons.length} Offer${plural} available ➔`;
    } else {
        offerHeaderText = '<span style="color:#999;">No offers ➔</span>';
    }

    container.innerHTML = `
        <div style="background: #fff; border-radius: 10px; margin-bottom: 12px; border: 1px solid #eef0f2; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            ${savedAddresses.length > 0 ? activeAddressDisplay : `
                <div style="text-align:center; padding:10px;">
                    <p style="font-size:14px; color:#666; margin-bottom:12px;">No delivery address found.</p>
                    <button class="btn-checkout" onclick="window.openNewAddressModal('checkout')">+ Add Delivery Address</button>
                </div>
            `}
            <div class="chk-body" id="chk-body-address" style="border-top: 1px dashed #eee; margin-top: 15px; padding-top: 15px;">
                ${savedAddresses.length > 0 ? addressHtml : ''}
            </div>
        </div>

        <div class="chk-section">
            <div class="chk-header" onclick="toggleChkBody('chk-body-summary')">
                <div class="chk-header-left"><span class="chk-header-icon">👜</span> Order Summary</div>
                <div class="chk-header-right">${totalItems} Items ⌄</div>
            </div>
            <div class="chk-body" id="chk-body-summary">${orderSummaryHtml}</div>
        </div>

        <div class="chk-section">
            <div class="chk-header" onclick="toggleChkBody('chk-body-coupon')">
                <div class="chk-header-left"><span class="chk-header-icon">🏷️</span> Apply Promo Code</div>
                <div class="chk-header-right" style="color: #128c7e; font-weight: bold;">${offerHeaderText}</div>
            </div>
            <div class="chk-body" id="chk-body-coupon">
                <div class="coupon-input-box" style="margin-bottom: 15px;">
                    <input type="text" id="coupon-input" placeholder="Enter Coupon Code" value="${checkoutState.couponCode}" style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px; text-transform: uppercase;">
                    <button onclick="applyManualCoupon()" style="background: #128c7e; color: white; border: none; padding: 0 15px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-left:10px;">APPLY</button>
                </div>
                
                <div id="applied-coupon-msg" style="display: ${checkoutState.couponCode !== '' ? 'block' : 'none'}; color: #10b981; font-weight: bold; font-size: 13px; margin-bottom: 10px; background: #ecfdf5; padding: 10px; border-radius: 6px; border: 1px dashed #10b981;">
                    ✅ '${checkoutState.couponCode}' applied. ${checkoutState.couponDiscount > 0 ? `You saved ₹${Math.round(checkoutState.couponDiscount)}!` : 'Reward added to your cart!'} 
                    <span onclick="window.removeCoupon()" style="color: #dc3545; cursor: pointer; text-decoration: underline; margin-left: 10px; float: right;">Remove</span>
                </div>
                
                <div id="available-coupons-list" style="display: ${checkoutState.couponCode !== '' ? 'none' : 'flex'}; flex-direction: column; gap: 10px;">
                </div>
            </div>
        </div>

        <div class="chk-section">
            <div class="chk-header" onclick="toggleChkBody('chk-body-price')">
                <div class="chk-header-left"><span class="chk-header-icon">₹</span> Price Details</div>
                <div class="chk-header-right" style="color:#111; font-weight:800;">₹${finalAmount} ⌄</div>
            </div>
            <div class="chk-body active" id="chk-body-price">
                <div class="price-row"><span>Items Total</span><span>₹${mrpTotal}</span></div>
                <div class="price-row discount"><span>Discount</span><span>-₹${itemDiscount}</span></div>
                <div class="price-row discount" style="display: ${checkoutState.couponDiscount > 0 ? 'flex' : 'none'};"><span>Coupon Discount</span><span>-₹${checkoutState.couponDiscount}</span></div>
                <div class="price-row"><span>Shipping</span><span><span style="color:#1e8354">FREE</span></span></div>
                <div class="price-row total"><span>Total Amount</span><span>₹${finalAmount}</span></div>
            </div>
        </div>

        <div class="chk-section">
            <div class="chk-header" onclick="toggleChkBody('chk-body-payment')">
                <div class="chk-header-left"><span class="chk-header-icon">💳</span> Payment Method</div>
                <div class="chk-header-right">${checkoutState.paymentMethod} ⌄</div>
            </div>
            <div class="chk-body active" id="chk-body-payment">
                <label class="address-radio-label ${checkoutState.paymentMethod === 'COD' ? 'selected' : ''}" onclick="checkoutState.paymentMethod='COD'; window.renderCheckoutPage(true);">
                    <div><strong style="color:#111; font-size:14px;">🚚 Cash on delivery</strong><br><span style="color:#666; font-size:12px;">Pay with cash</span></div>
                    <input type="radio" name="paySelect" class="radio-custom" ${checkoutState.paymentMethod === 'COD' ? 'checked' : ''} style="pointer-events: none;">
                </label>
                <label class="address-radio-label ${checkoutState.paymentMethod === 'UPI' ? 'selected' : ''}" onclick="checkoutState.paymentMethod='UPI'; window.renderCheckoutPage(true);">
                    <div><strong style="color:#111; font-size:14px;">📱 Pay via UPI</strong><br><span style="color:#666; font-size:12px;">Use any registered UPI ID</span></div>
                    <input type="radio" name="paySelect" class="radio-custom" ${checkoutState.paymentMethod === 'UPI' ? 'checked' : ''} style="pointer-events: none;">
                </label>
            </div>
        </div>
    `;

    setTimeout(() => { window.renderAvailableCoupons(); }, 100);
}

window.toggleChkBody = function (id) {
    const el = document.getElementById(id);
    if (el.classList.contains('active')) el.classList.remove('active');
    else el.classList.add('active');
}


window.renderAvailableCoupons = function () {
    const list = document.getElementById('available-coupons-list');
    if (!list) return;
    list.innerHTML = '';

    let eligibleTotal = 0;
    cart.forEach(item => { if (!item.isPromoGift && !item.isFreeGift) eligibleTotal += (parseFloat(item.sellingPrice) * item.quantity); });

    // 🌟 Sirf Valid (Non-Expired) Coupons Customer ko dikhayenge
    let validCoupons = availableCoupons.filter(c => {
        if (c.expiryDate) {
            return new Date(c.expiryDate) >= new Date(new Date().setHours(0, 0, 0, 0));
        }
        return true;
    });

    if (validCoupons.length === 0) {
        list.innerHTML = '<p style="font-size: 13px; color: #777; text-align: center;">No offers available right now.</p>';
        return;
    }

    validCoupons.forEach(c => {
        let isEligible = eligibleTotal >= c.minOrder;

        let discountText = '';
        if (c.type === 'FLAT') discountText = `₹${c.details ? c.details.discountValue : c.value} OFF`;
        else if (c.type === 'PERCENT') discountText = `${c.details ? c.details.discountPercent : c.value}% OFF`;
        else if (c.type === 'FREE_GIFT') discountText = `🎁 Free Gift Included`;
        else if (c.type === 'FREE_CHOICE') discountText = `🎁 Choose 1 Free Item`;
        else if (c.type === 'DISCOUNTED_CHOICE') discountText = `🔥 Special Discounted Item`;

        list.innerHTML += `
            <div style="border: 1px dashed ${isEligible ? '#128c7e' : '#ccc'}; padding: 12px; border-radius: 6px; background: ${isEligible ? '#f0fdf4' : '#f9f9f9'}; opacity: ${isEligible ? '1' : '0.6'}; transition: 0.3s; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #111; font-size: 15px;">${c.code}</strong>
                    ${isEligible
                ? `<button onclick="window.applyCoupon('${c.code}')" style="background: transparent; border: 1px solid #128c7e; color: #128c7e; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">APPLY</button>`
                : `<span style="font-size: 11px; color: #e11d48; font-weight: bold;">Add ₹${c.minOrder - eligibleTotal} more</span>`
            }
                </div>
                <div style="font-size: 12px; color: #555; margin-top: 4px;">${discountText} on orders above ₹${c.minOrder}</div>
            </div>
        `;
    });
}
window.applyManualCoupon = function () {
    const code = document.getElementById('coupon-input').value.toUpperCase().trim();
    if (!code) return;
    window.applyCoupon(code);
}

// ==========================================
// 🎟️ ADVANCE PROMO CODE & REWARD LOGIC
// ==========================================

// Cart Nudge Logic (Update Cart UI me call hoga)
window.evaluateCouponNudges = function () {
    const banner = document.getElementById('cart-gift-banner');
    if (!banner) return;
    banner.style.display = 'none';

    let eligibleTotal = 0;
    cart.forEach(item => { if (!item.isPromoGift && !item.isFreeGift) eligibleTotal += (parseFloat(item.sellingPrice) * item.quantity); });

    // Find upcoming coupons that have a nudge message
    let upcomingCoupons = availableCoupons.filter(c => c.minOrder > eligibleTotal && c.nudgeMsg);
    upcomingCoupons.sort((a, b) => a.minOrder - b.minOrder);

    if (upcomingCoupons.length > 0) {
        let targetCoupon = upcomingCoupons[0];
        let remaining = targetCoupon.minOrder - eligibleTotal;
        let msg = targetCoupon.nudgeMsg.replace('{amount}', remaining);
        banner.innerHTML = `🌟 ${msg}`;
        banner.style.display = 'block';
    }
}

// Update `updateCartUI` function to use new Nudge system
// Find `evaluateFreeGift(showPopup);` inside updateCartUI and REPLACE it with:
// window.evaluateCouponNudges();

window.applyCoupon = function (code) {
    const coupon = availableCoupons.find(c => c.code === code);
    if (!coupon) { alert("Invalid Promo Code!"); return; }

    // 🌟 BUG FIX: Naya coupon process karne se pehle, purana coupon aur uske free items cart se hata do
    window.removeCoupon(false);

    let eligibleTotal = 0;
    cart.forEach(item => { if (!item.isPromoGift && !item.isFreeGift) eligibleTotal += (parseFloat(item.sellingPrice) * item.quantity); });

    if (eligibleTotal < coupon.minOrder) {
        alert(`This coupon requires a minimum order of ₹${coupon.minOrder}`);
        return;
    }

    if (coupon.type === 'FLAT' || coupon.type === 'PERCENT') {
        let discount = 0;
        if (coupon.type === 'FLAT') discount = coupon.details.discountValue;
        else if (coupon.type === 'PERCENT') {
            discount = (eligibleTotal * coupon.details.discountPercent) / 100;
            if (discount > coupon.details.maxDiscount) discount = coupon.details.maxDiscount;
        }
        if (discount > eligibleTotal) discount = eligibleTotal;

        checkoutState.couponCode = coupon.code;
        checkoutState.couponDiscount = discount;
        renderCheckoutPage();
        checkoutState.couponCode = coupon.code;
        checkoutState.couponDiscount = discount;
        renderCheckoutPage();

        // NAYA VISUAL EFFECT
        window.showCelebration("WOOHOO! 🥳", `You just saved ₹${Math.round(discount)} on this order!`);
    }
    else if (coupon.type === 'FREE_GIFT') {
        window.addPromoItemToCart(coupon.details.productId, 0, coupon.code);
    }
    else if (coupon.type === 'FREE_CHOICE' || coupon.type === 'DISCOUNTED_CHOICE') {
        window.openPromoChoiceModal(coupon);
    }
}

window.openPromoChoiceModal = function (coupon) {
    document.getElementById('activePromoCodeSelected').value = coupon.code;
    document.getElementById('activePromoCodeType').value = coupon.type;
    const list = document.getElementById('promoChoiceList');
    list.innerHTML = '';

    document.getElementById('promoChoiceTitle').innerText = coupon.type === 'FREE_CHOICE' ? '🎁 Select Your Free Gift' : '🔥 Select Discounted Item';

    let itemsToRender = coupon.type === 'FREE_CHOICE' ? coupon.details.productIds : coupon.details.discountedItems;

    itemsToRender.forEach((item, index) => {
        let productId = coupon.type === 'FREE_CHOICE' ? item : item.productId;
        let specialPrice = coupon.type === 'FREE_CHOICE' ? 0 : item.offerPrice;
        let productData = allProducts.find(p => p.id === productId);

        if (productData) {
            let isChecked = index === 0 ? 'checked' : '';
            list.innerHTML += `
                <label style="display:flex; align-items:center; background:#fff; padding:12px; border-radius:8px; border:1px solid ${isChecked ? '#128c7e' : '#ddd'}; cursor:pointer; gap:10px;">
                    <input type="radio" name="promoChoiceRadio" value="${productId}" data-price="${specialPrice}" style="accent-color:#128c7e; width:18px; height:18px;" ${isChecked}>
                    <img src="${productData.img}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;">
                    <div style="flex:1;">
                        <div style="font-size:14px; font-weight:bold; color:#111;">${productData.name}</div>
                        <div style="font-size:13px; color:#128c7e; font-weight:bold;">${specialPrice === 0 ? 'FREE' : 'Special Price: ₹' + specialPrice} <strike style="color:#999; font-size:11px; font-weight:normal;">₹${productData.sellingPrice}</strike></div>
                    </div>
                </label>
            `;
        }
    });

    document.getElementById('promo-choice-overlay').classList.add('active');
}

window.confirmPromoChoice = function () {
    const selectedRadio = document.querySelector('input[name="promoChoiceRadio"]:checked');
    if (!selectedRadio) { alert("Please select an item!"); return; }

    const productId = selectedRadio.value;
    const specialPrice = Number(selectedRadio.getAttribute('data-price'));
    const code = document.getElementById('activePromoCodeSelected').value;

    closePromoChoiceModal();
    window.addPromoItemToCart(productId, specialPrice, code);
}

window.addPromoItemToCart = function (productId, specialPrice, promoCode) {
    // Agar pehle se koi code laga hai, usko hatai
    window.removeCoupon(false);

    const product = allProducts.find(p => p.id === productId);
    if (product) {
        cart.push({
            ...product,
            id: product.id + "_PROMO",
            originalId: product.id,
            quantity: 1,
            sellingPrice: specialPrice,
            isPromoGift: true,
            appliedPromoCode: promoCode,
            name: `🎁 [PROMO] ${product.name}`
        });

        checkoutState.couponCode = promoCode;
        checkoutState.couponDiscount = 0; // Kyunki discount item ke rate me adjustment karke diya hai
        renderCheckoutPage();
        updateCartUI(false);
        checkoutState.couponCode = promoCode;
        checkoutState.couponDiscount = 0;
        renderCheckoutPage();
        updateCartUI(false);

        // NAYA VISUAL EFFECT
        let subtitleText = specialPrice === 0 ? "You got a FREE ITEM added to your cart! 🎁" : "You unlocked a Special Discounted Item! 🔥";
        window.showCelebration("AWESOME! 🎉", subtitleText);
    }
}

window.removeCoupon = function (renderUI = true) {
    checkoutState.couponCode = '';
    checkoutState.couponDiscount = 0;
    // Cart me se saare isPromoGift wale items uda do
    cart = cart.filter(item => !item.isPromoGift);
    if (renderUI) {
        renderCheckoutPage();
        updateCartUI(false);
    }
}

// 🛒 Order Finalize Function
window.finalizeOrder = async function () {
    if (cart.length === 0) return;

    const btn = document.querySelector('.checkout-modal .btn-checkout') || document.querySelector('.btn-full');
    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const docSnap = await getDoc(doc(db, "customers", loggedInUser));
        let selectedAddress = null;
        if (docSnap.exists() && docSnap.data().addresses && docSnap.data().addresses.length > 0) {
            selectedAddress = docSnap.data().addresses[checkoutState.selectedAddressIndex];
        }

        if (!selectedAddress) {
            alert("Please add a delivery address before proceeding.");
            btn.innerText = "Proceed to pay"; btn.disabled = false;
            return;
        }

        let sellingTotal = 0;
        cart.forEach(item => { sellingTotal += (parseFloat(item.sellingPrice) * item.quantity); });
        let finalGrandTotal = sellingTotal - checkoutState.couponDiscount;

        const orderData = {
            customerMobile: loggedInUser,
            deliveryAddress: selectedAddress,
            items: cart,
            totalAmount: finalGrandTotal,
            couponApplied: checkoutState.couponCode || 'None',
            paymentMethod: checkoutState.paymentMethod,
            status: "New",
            orderDate: new Date().toISOString()
        };

        // 1. Order database me save hua
        const newOrderRef = await addDoc(collection(db, "orders"), orderData);
        const shortOrderId = "ORD" + newOrderRef.id.substring(0, 6).toUpperCase();

        // 🌟 2. NAYA: STOCK DEDUCTION LOGIC
        for (let item of cart) {
            if (item.isFreeGift) continue;
            try {
                const pRef = doc(db, "products", item.id);
                const pSnap = await getDoc(pRef);
                if (pSnap.exists()) {
                    let currentStock = pSnap.data().stockQty;
                    if (currentStock !== undefined) {
                        let newStock = currentStock - item.quantity;
                        if (newStock < 0) newStock = 0;
                        await updateDoc(pRef, { stockQty: newStock });
                    }
                }
            } catch (e) { console.error("Stock update failed", e); }
        }

        // 3. Cart khali karein aur modal band karein
        cart = [];
        updateCartUI();
        closeCheckoutPage();
        checkoutState = { selectedAddressIndex: 0, paymentMethod: 'COD', couponCode: '', couponDiscount: 0 };

        document.getElementById('success-order-id').innerText = shortOrderId;
        document.getElementById('order-success-modal').style.display = 'flex';

        btn.innerText = "Proceed to pay"; btn.disabled = false;

    } catch (error) {
        alert("Order error: " + error.message);
        btn.innerText = "Proceed to pay"; btn.disabled = false;
    }
}

window.closeSuccessModal = function () {
    document.getElementById('order-success-modal').style.display = 'none';
}

window.closeSuccessAndOpenProfile = function () {
    document.getElementById('order-success-modal').style.display = 'none';
    openProfile();
    setTimeout(() => { renderMyOrders(); }, 300);
}

// ==========================================
// 👤 5. PROFILE SECTION LOGIC
// ==========================================

let currentProfileScreen = 'home';
let currentCustomerOrders = [];
let currentSavedAddresses = [];

window.openProfile = function () {
    document.getElementById('profile-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderProfileHome();
}

window.closeProfile = function () {
    document.getElementById('profile-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

window.handleProfileBack = function () {
    if (currentProfileScreen === 'home') { closeProfile(); }
    else { renderProfileHome(); }
}

window.logoutUser = function () {
    loggedInUser = null;
    localStorage.removeItem('customerMobile');
    closeProfile();
    alert("Logged out successfully");
}

window.renderProfileHome = function () {
    currentProfileScreen = 'home';
    document.getElementById('profile-title').innerText = "My Account";
    const container = document.getElementById('profile-content-container');
    let displayPhone = loggedInUser ? `+91 ${loggedInUser}` : 'Not Logged In';

    container.innerHTML = `
        <div class="user-info-card">
            <div class="user-info-text">
                <h3>Hi! User</h3>
                <p>${displayPhone}</p>
            </div>
            <div class="user-avatar">👤</div>
        </div>
        
        <div class="profile-menu">
            <div class="profile-menu-item" onclick="renderMyOrders()">
                <div class="menu-item-left"><span class="menu-icon">📦</span> My Orders</div>
                <div class="menu-arrow">›</div>
            </div>
            <div class="profile-menu-item" onclick="renderMyAddresses()">
                <div class="menu-item-left"><span class="menu-icon">📍</span> Address Book</div>
                <div class="menu-arrow">›</div>
            </div>
            <div class="profile-menu-item" onclick="alert('Help & Support coming soon!')">
                <div class="menu-item-left"><span class="menu-icon">🎧</span> Help & Support</div>
                <div class="menu-arrow">›</div>
            </div>
        </div>
        
        <div class="logout-btn-card" onclick="logoutUser()">
            Logout from MyStore
        </div>
    `;
}

let unsubscribeOrders = null;

window.renderMyOrders = function () {
    currentProfileScreen = 'orders';
    document.getElementById('profile-title').innerText = "Your Orders";
    const container = document.getElementById('profile-content-container');
    container.innerHTML = '<p style="text-align:center; padding: 30px;">Loading your orders...</p>';

    try {
        const q = query(collection(db, "orders"), where("customerMobile", "==", loggedInUser));

        if (unsubscribeOrders) {
            unsubscribeOrders();
        }

        unsubscribeOrders = onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                if (currentProfileScreen === 'orders') {
                    container.innerHTML = '<p style="text-align:center; padding: 30px; color:#777;">No orders found yet.</p>';
                }
                return;
            }

            currentCustomerOrders = [];
            querySnapshot.forEach(doc => currentCustomerOrders.push({ id: doc.id, ...doc.data() }));
            currentCustomerOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

            let html = '';
            currentCustomerOrders.forEach(order => {
                let totalItems = 0;
                if (order.items) { order.items.forEach(i => totalItems += i.quantity); }

                let dateObj = new Date(order.orderDate);
                let dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                let timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                let shortOrderId = "ORD" + order.id.substring(0, 6).toUpperCase();

                let itemsListHtml = '';
                if (order.items && order.items.length > 0) {
                    order.items.forEach(item => {
                        let itemRowTotal = parseFloat(item.sellingPrice) * item.quantity;
                        itemsListHtml += `
                            <div class="hist-item-row">
                                <div class="hist-item-left">
                                    <img src="${item.img}" class="hist-item-img" alt="img">
                                    <div>
                                        <div class="hist-item-name">${item.name}</div>
                                        <div class="hist-item-qty-price">₹${item.sellingPrice} x ${item.quantity}</div>
                                    </div>
                                </div>
                                <div class="hist-item-total">₹${itemRowTotal}</div>
                            </div>
                        `;
                    });
                }

                let cancelBtnHtml = '';
                if (order.status === 'New' || order.status === 'Processing') {
                    cancelBtnHtml = `
                        <div style="margin-top: 10px;">
                            <span style="color:#dc3545; font-size:12px; font-weight:bold; cursor:pointer;" onclick="window.cancelOrder('${order.id}')">❌ Cancel Order</span>
                        </div>
                    `;
                }

                html += `
                    <div class="order-card">
                        <div class="order-top">
                            <div class="order-details-left">
                                <h4>Order Id: ${shortOrderId}</h4>
                                <p>Total Amount: ₹${order.totalAmount}.00</p>
                                <p>Total Items: ${totalItems}</p>
                            </div>
                            <div class="order-details-right">
                                <span>Placed On</span>
                                <div class="date">${dateStr} @<br>${timeStr}</div>
                            </div>
                        </div>
                        <div class="dotted-divider"></div>
                        <div class="order-bottom">
                            <div>
                                <span class="status-badge ${order.status}">${order.status}</span>
                                ${cancelBtnHtml}
                            </div>
                            <span class="view-details" style="cursor:pointer;" onclick="window.toggleOrderDetails('${order.id}', this)">View Details ↓</span>
                        </div>
                        <div id="details-${order.id}" class="order-items-details" style="display: none;">
                            ${itemsListHtml}
                            <button class="btn-reorder-all" onclick="window.reorderItems('${order.id}')">
                                🔁 Repeat Order / Add Items to Cart
                            </button>
                        </div>
                    </div>
                `;
            });

            if (currentProfileScreen === 'orders') {
                container.innerHTML = html;
            }
        });
    } catch (error) {
        container.innerHTML = '<p style="text-align:center; color:red;">Failed to load orders.</p>';
    }
}

window.cancelOrder = async function (orderId) {
    if (confirm("Are you sure you want to cancel this order?")) {
        try {
            await updateDoc(doc(db, "orders", orderId), {
                status: "Cancelled"
            });
            alert("Order cancelled successfully!");
        } catch (error) {
            alert("Error cancelling order: " + error.message);
        }
    }
}

window.toggleOrderDetails = function (orderId, element) {
    const detailsDiv = document.getElementById(`details-${orderId}`);
    if (detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        element.innerText = 'Hide Details ↑';
    } else {
        detailsDiv.style.display = 'none';
        element.innerText = 'View Details ↓';
    }
}

window.reorderItems = function (orderId) {
    const order = currentCustomerOrders.find(o => o.id === orderId);
    if (order && order.items) {
        order.items.forEach(histItem => {
            const existingItem = cart.find(item => item.id === histItem.id);
            if (existingItem) { existingItem.quantity += histItem.quantity; }
            else { cart.push({ ...histItem }); }
            updateProductActionUI(histItem.id);
        });
        updateCartUI();
        closeProfile();
        openCart();
    }
}

// ==========================================
// 📍 ADDRESS BOOK LOGIC
// ==========================================

window.renderMyAddresses = async function () {
    currentProfileScreen = 'addresses';
    document.getElementById('profile-title').innerText = "Address Book";

    const container = document.getElementById('profile-content-container');
    container.innerHTML = '<p style="text-align:center; padding: 30px;">Loading your addresses...</p>';

    try {
        const docRef = doc(db, "customers", loggedInUser);
        const docSnap = await getDoc(docRef);

        let html = `<div class="add-new-addr-btn" onclick="window.openNewAddressModal('profile')">+ Add New Address</div>`;

        if (docSnap.exists() && docSnap.data().addresses && docSnap.data().addresses.length > 0) {
            currentSavedAddresses = docSnap.data().addresses;

            currentSavedAddresses.forEach((addr, idx) => {
                let displayFull = "";
                let displayTag = "HOME";

                if (typeof addr === 'string') {
                    displayFull = addr;
                } else {
                    displayFull = `<strong>${addr.fullName}</strong><br>${addr.building}, ${addr.area}<br>${addr.city}, ${addr.state} - <strong>${addr.pincode}</strong>`;
                    displayTag = addr.type ? addr.type.toUpperCase() : "HOME";
                }

                html += `
                    <div class="address-card">
                        <div class="addr-header">
                            <span class="addr-name">Address ${idx + 1} ${idx === 0 ? '(Default)' : ''}</span>
                            <span class="addr-tag">${displayTag}</span>
                        </div>
                        <div class="addr-full">${displayFull}</div>
                        <div class="addr-mobile">Mobile No: ${loggedInUser}</div>
                        <div class="addr-actions">
                            <span style="color:#128c7e; margin-right: 20px; cursor:pointer;" onclick="window.editAddress(${idx}, 'profile')">✏️ Edit</span>
                            <span style="color:#dc3545; cursor:pointer;" onclick="window.deleteAddress(${idx})">🗑️ Delete</span>
                        </div>
                    </div>
                `;
            });
        } else {
            currentSavedAddresses = [];
            html += '<p style="text-align:center; font-size:14px; color:#777; margin-top:30px;">No saved addresses found.</p>';
        }
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="text-align:center; color:red;">Failed to load addresses.</p>';
    }
}

// ==========================================
// 🌐 6. GLOBAL SMART ADDRESS MODAL
// ==========================================

let addressModalSource = 'profile';

function injectGlobalAddressModal() {
    if (document.getElementById('new-address-overlay')) return;
    const modalHtml = `
        <div id="new-address-overlay" class="address-overlay" style="z-index: 3500;">
            <div class="address-box-modal">
                <div class="address-header">
                    <h3 id="addressModalTitle">Add Address</h3>
                    <span class="close-btn" onclick="closeNewAddressForm()">&times;</span>
                </div>
                <div class="address-form-body">
                    <input type="hidden" id="editAddressIdx" value="">
                    <input type="text" id="addrFullName" class="addr-input" placeholder="Full Name *" required>
                    <input type="tel" id="addrMobile" class="addr-input" placeholder="Mobile Number (For Delivery) *" required>
                    
                    <input type="email" id="addrEmail" class="addr-input" placeholder="Email Address (Optional)">
                    <input type="text" id="addrBuilding" class="addr-input" placeholder="Office / Building Name *" required>
                    <input type="text" id="addrArea" class="addr-input" placeholder="Area / Street / Sector / Village *" required>
                    <input type="text" id="addrState" class="addr-input" placeholder="State *" required>
                    <input type="text" id="addrCity" class="addr-input" placeholder="City *" required>
                    <input type="number" id="addrPincode" class="addr-input" placeholder="Pincode *" required>
                    
                    <div class="addr-type-section">
                        <label>Save address as*</label>
                        <div class="addr-type-chips">
                            <button class="type-chip active" onclick="selectAddrType('Home', this)">Home</button>
                            <button class="type-chip" onclick="selectAddrType('Work', this)">Work</button>
                            <button class="type-chip" onclick="selectAddrType('Other', this)">Other</button>
                        </div>
                        <input type="hidden" id="addrTypeSelected" value="Home">
                    </div>
                </div>
                <button id="addrSubmitBtn" class="btn-save-address" onclick="saveNewAddress()">Save & Continue</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
injectGlobalAddressModal();

window.openNewAddressModal = function (source = 'profile') {
    addressModalSource = source;
    document.getElementById('editAddressIdx').value = "";
    document.getElementById('addressModalTitle').innerText = "Add Delivery Address";
    document.getElementById('addrSubmitBtn').innerText = source === 'checkout' ? "Save & Proceed to Checkout" : "Save Address";

    document.getElementById('addrFullName').value = "";
    document.getElementById('addrMobile').value = loggedInUser || "";
    document.getElementById('addrEmail').value = "";
    document.getElementById('addrBuilding').value = "";
    document.getElementById('addrArea').value = "";
    document.getElementById('addrState').value = "";
    document.getElementById('addrCity').value = "";
    document.getElementById('addrPincode').value = "";

    document.getElementById('addrTypeSelected').value = "Home";
    const chips = document.querySelectorAll('.type-chip');
    chips.forEach(chip => {
        if (chip.innerText.trim() === 'Home') chip.classList.add('active');
        else chip.classList.remove('active');
    });
    document.getElementById('new-address-overlay').classList.add('active');
}

window.editAddress = function (index, source = 'profile') {
    addressModalSource = source;
    const addr = currentSavedAddresses[index];
    if (!addr || typeof addr === 'string') {
        alert("Puraane format ka address edit nahi ho sakta, delete karke naya add karein.");
        return;
    }
    document.getElementById('editAddressIdx').value = index;
    document.getElementById('addressModalTitle').innerText = "Edit Address";
    document.getElementById('addrSubmitBtn').innerText = source === 'checkout' ? "Update & Proceed" : "Update Address";

    document.getElementById('addrFullName').value = addr.fullName || '';
    document.getElementById('addrMobile').value = addr.mobile || loggedInUser || '';
    document.getElementById('addrEmail').value = addr.email || '';
    document.getElementById('addrBuilding').value = addr.building || '';
    document.getElementById('addrArea').value = addr.area || '';
    document.getElementById('addrState').value = addr.state || '';
    document.getElementById('addrCity').value = addr.city || '';
    document.getElementById('addrPincode').value = addr.pincode || '';

    const type = addr.type || 'Home';
    document.getElementById('addrTypeSelected').value = type;
    const chips = document.querySelectorAll('.type-chip');
    chips.forEach(chip => {
        if (chip.innerText.trim() === type) chip.classList.add('active');
        else chip.classList.remove('active');
    });
    document.getElementById('new-address-overlay').classList.add('active');
}

window.closeNewAddressForm = function () {
    document.getElementById('new-address-overlay').classList.remove('active');
}

window.selectAddrType = function (type, element) {
    document.getElementById('addrTypeSelected').value = type;
    const chips = document.querySelectorAll('.type-chip');
    chips.forEach(chip => chip.classList.remove('active'));
    element.classList.add('active');
}

window.saveNewAddress = async function () {
    const fullName = document.getElementById('addrFullName').value.trim();
    const mobile = document.getElementById('addrMobile').value.trim();
    const email = document.getElementById('addrEmail').value.trim();
    const building = document.getElementById('addrBuilding').value.trim();
    const area = document.getElementById('addrArea').value.trim();
    const state = document.getElementById('addrState').value.trim();
    const city = document.getElementById('addrCity').value.trim();
    const pincode = document.getElementById('addrPincode').value.trim();
    const type = document.getElementById('addrTypeSelected').value;
    const editIdx = document.getElementById('editAddressIdx').value;

    if (!fullName || !mobile || !building || !area || !state || !city || !pincode) {
        alert("Please fill all required (*) fields");
        return;
    }

    const btn = document.getElementById('addrSubmitBtn');
    btn.innerText = "Saving..."; btn.disabled = true;

    const newAddressObj = { fullName, mobile, email, building, area, state, city, pincode, type };
    const docRef = doc(db, "customers", loggedInUser);

    try {
        if (editIdx !== "") {
            let updatedAddresses = [...currentSavedAddresses];
            updatedAddresses[parseInt(editIdx)] = newAddressObj;
            await updateDoc(docRef, { addresses: updatedAddresses });
        } else {
            await updateDoc(docRef, { addresses: arrayUnion(newAddressObj) });
        }

        closeNewAddressForm();

        if (addressModalSource === 'checkout') {
            if (editIdx === "") {
                const docSnap2 = await getDoc(docRef);
                if (docSnap2.exists() && docSnap2.data().addresses) {
                    checkoutState.selectedAddressIndex = docSnap2.data().addresses.length - 1;
                }
            }
            renderCheckoutPage();
        } else {
            renderMyAddresses();
        }

        btn.innerText = "Save Address"; btn.disabled = false;
    } catch (e) {
        alert("Error saving address");
        btn.innerText = "Try Again"; btn.disabled = false;
    }
}

let toastTimeout;
window.showToast = function (msg, isSuccess) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.innerHTML = msg;

    toast.style.backgroundColor = isSuccess ? '#10b981' : '#f59e0b';
    toast.style.display = 'block';
    toast.style.opacity = '1';

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 3000);
}

// 🔍 SEARCH LOGIC
window.handleSearch = function () {
    let query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (query === '') {
        renderCategoryNav();
        renderCatalog(); // Wapas normal screen
        return;
    }

    let filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.mainCategory.toLowerCase().includes(query) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(query))
    );

    document.getElementById('category-nav').innerHTML = '';
    document.getElementById('sub-category-nav').classList.add('hidden');

    mainContainer.innerHTML = `<div class="category-section"><div class="category-header"><h3>Search Results</h3></div></div>`;
    let section = mainContainer.querySelector('.category-section');

    if (filtered.length === 0) {
        section.innerHTML += `<p style="text-align:center; color:#777; padding: 30px;">No items found for "${query}" 😥</p>`;
    } else {
        filtered.forEach(p => section.appendChild(window.createProductItem(p)));
    }
}

// ==========================================
// 🛍️ PRODUCT DETAILS PAGE (PDP) LOGIC
// ==========================================

window.openPDP = function (productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('pdp-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    let mrp = parseFloat(product.mrp);
    let sp = parseFloat(product.sellingPrice);
    let savePercent = Math.round(((mrp - sp) / mrp) * 100);

    let weight = product.weight || "Standard Pack";
    let benefits = product.benefits || "• Premium Quality\n• 100% Authentic & Pure\n• Freshly packed";
    let benefitsHtml = benefits.split('\n').map(b => `<li style="margin-left: 15px; color:#555; font-size:14px; margin-bottom:5px;">${b}</li>`).join('');

    let related = allProducts.filter(p => p.mainCategory === product.mainCategory && p.id !== product.id).slice(0, 4);
    let relatedHtml = '';
    related.forEach(rp => {
        relatedHtml += `
            <div style="min-width: 130px; max-width: 130px; background: #fff; border-radius: 8px; padding: 10px; border: 1px solid #eee; cursor: pointer;" onclick="window.openPDP('${rp.id}')">
                <img src="${rp.img}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 6px;">
                <div style="font-size: 13px; font-weight: bold; margin-top: 8px; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rp.name}</div>
                <div style="font-size: 14px; font-weight: 800; color: #128c7e; margin-top: 4px;">₹${rp.sellingPrice}</div>
            </div>
        `;
    });

    const container = document.getElementById('pdp-content-container');
    container.innerHTML = `
        <div style="background: #fff; width: 100%; overflow-x: auto; scroll-snap-type: x mandatory; display: flex; scrollbar-width: none;">
            <div style="min-width: 100%; scroll-snap-align: center; display: flex; justify-content: center; align-items: center; background: #f9f9f9; overflow: hidden; position: relative;">
                <img src="${product.img}" style="width: 100%; height: 350px; object-fit: contain; cursor: zoom-in; transition: transform 0.3s ease;" 
                     onclick="this.style.transform = this.style.transform === 'scale(1.8)' ? 'scale(1)' : 'scale(1.8)'; this.style.cursor = this.style.transform === 'scale(1.8)' ? 'zoom-out' : 'zoom-in';">
            </div>
        </div>
        <div style="background: #fff; padding: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee;">
            <h1 style="font-size: 20px; color: #111; margin-bottom: 8px; font-weight: 800;">${product.name}</h1>
            <div style="color: #666; font-size: 14px; margin-bottom: 15px;">Net Weight: <strong style="color: #333;">${weight}</strong></div>
            <div style="display: flex; align-items: baseline; gap: 10px;">
                <span style="font-size: 28px; font-weight: 800; color: #111;">₹${product.sellingPrice}</span>
                <span style="font-size: 16px; color: #999; text-decoration: line-through;">₹${product.mrp}</span>
                <span style="background: #e6f4ea; color: #166534; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: bold; margin-left: auto;">Save ${savePercent}%</span>
            </div>
            ${product.stockQty <= 10 && product.stockQty > 0 ? `<p style="color: #dc3545; font-size: 12px; font-weight: bold; margin-top: 10px;">⏳ Hurry! Only ${product.stockQty} left in stock</p>` : ''}
        </div>
        <div style="background: #fff; padding: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee;">
            <h3 style="font-size: 16px; margin-bottom: 15px; color: #111; display: flex; align-items: center; gap: 8px;">✨ Why Buy This?</h3>
            <ul style="padding: 0; list-style-type: none;">${benefitsHtml}</ul>
        </div>
        <div style="background: #fff; padding: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee;">
            <h3 style="font-size: 16px; margin-bottom: 10px; color: #111;">📝 Product Description</h3>
            <p style="font-size: 14px; color: #555; line-height: 1.6;">${product.desc}</p>
        </div>
        ${related.length > 0 ? `
        <div style="background: #fff; padding: 20px;">
            <h3 style="font-size: 16px; margin-bottom: 15px; color: #111;">🛒 You might also like</h3>
            <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: none;">
                ${relatedHtml}
            </div>
        </div>
        ` : ''}
    `;

    if (product.stockQty !== undefined && product.stockQty <= 0) {
        document.getElementById('pdp-add-btn').innerText = "Out of Stock";
        document.getElementById('pdp-add-btn').style.opacity = "0.5";
        document.getElementById('pdp-buy-btn').style.display = "none";
    } else {
        document.getElementById('pdp-add-btn').innerText = "Add to Cart";
        document.getElementById('pdp-add-btn').style.opacity = "1";
        document.getElementById('pdp-buy-btn').style.display = "block";
        document.getElementById('pdp-add-btn').onclick = () => { window.addToCart(product.id); window.showToast('Item added to cart! 🛒', true); };
        document.getElementById('pdp-buy-btn').onclick = () => { window.addToCart(product.id); closePDP(); openLoginModal('checkout'); };
    }
}

window.closePDP = function () {
    document.getElementById('pdp-modal').classList.add('hidden');
    document.body.style.overflow = '';
}


// ==========================================
// 🎁 GLOBAL PROMO CHOICE MODAL (INJECTED VIA JS)
// ==========================================
function injectPromoChoiceModal() {
    if (document.getElementById('promo-choice-overlay')) return;
    const modalHtml = `
        <div id="promo-choice-overlay" class="login-overlay" style="z-index: 4000;">
            <div class="login-box" style="background:#f4f6f8;">
                <div class="login-header">
                    <h3 id="promoChoiceTitle">Select Your Reward</h3>
                    <span class="close-login" onclick="closePromoChoiceModal()">&times;</span>
                </div>
                <p style="color: #666; font-size: 13px; margin-bottom: 15px;" id="promoChoiceSubtitle">Choose 1 item from the list below:</p>
                
                <div id="promoChoiceList" style="max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                    </div>
                
                <input type="hidden" id="activePromoCodeSelected">
                <input type="hidden" id="activePromoCodeType">
                <button type="button" class="btn-checkout btn-full" onclick="confirmPromoChoice()">Claim Reward</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
injectPromoChoiceModal();

window.closePromoChoiceModal = function () {
    document.getElementById('promo-choice-overlay').classList.remove('active');
}

// ==========================================
// 🎉 CELEBRATION VISUAL EFFECT
// ==========================================
window.showCelebration = function (title, subtitle) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100dvh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    const box = document.createElement('div');
    box.style.backgroundColor = '#fff';
    box.style.padding = '30px 20px';
    box.style.borderRadius = '16px';
    box.style.textAlign = 'center';
    box.style.width = '80%';
    box.style.maxWidth = '320px';
    box.style.transform = 'scale(0.5)';
    box.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';

    box.innerHTML = `
        <div style="font-size: 55px; margin-bottom: 10px; animation: bounce 1s infinite alternate;">🎊</div>
        <h2 style="color: #128c7e; margin-bottom: 8px; font-size: 22px; font-weight: 900; text-transform: uppercase;">${title}</h2>
        <p style="color: #555; font-size: 15px; font-weight: bold;">${subtitle}</p>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Animate In
    setTimeout(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
    }, 50);

    // Auto Remove After 2.5 seconds
    setTimeout(() => {
        overlay.style.opacity = '0';
        box.style.transform = 'scale(0.5)';
        setTimeout(() => {
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
        }, 300);
    }, 2500);
}

// ==========================================
// 🚀 INITIALIZE APP
// ==========================================
listenProducts();
listenCoupons();
