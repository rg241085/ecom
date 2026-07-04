import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, where, getDocs, updateDoc, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// 🌟 NAYA IMPORT: Firebase Auth OTP ke liye
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
const auth = getAuth(app); // 🌟 Auth initialize kiya
auth.useDeviceLanguage();  // OTP SMS local language me bhejne ke liye

const mainContainer = document.getElementById('catalog-main');
// ... baaki puraana code
let cart = [];
let allProducts = [];
let productsByCategory = {};
let selectedCategory = "All";

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
            products.forEach(product => { section.appendChild(createProductItem(product)); });
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
            productsGroupedBySub[sub].forEach(product => { section.appendChild(createProductItem(product)); });
            mainContainer.appendChild(section);
        });
        setupIntersectionObserver();
    }
}

function createProductItem(product) {
    let div = document.createElement('div');
    div.classList.add('product-item');

    const cartItem = cart.find(item => item.id === product.id);
    let actionHTML = '';

    if (cartItem) {
        actionHTML = `
            <div class="qty-controls">
                <button class="btn-qty" onclick="window.decreaseQuantity('${product.id}')">-</button>
                <span class="qty-count">${cartItem.quantity}</span>
                <button class="btn-qty" onclick="window.addToCart('${product.id}')">+</button>
            </div>
        `;
    } else {
        actionHTML = `<button class="btn-add" onclick="window.addToCart('${product.id}')">ADD</button>`;
    }

    div.innerHTML = `
        <img src="${product.img}" alt="Product" class="product-img">
        <div class="product-info">
            <h4 class="product-title">${product.name}</h4>
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
        if (existingItem) { existingItem.quantity += 1; }
        else { cart.push({ ...product, quantity: 1 }); }
        updateProductActionUI(productId);
        updateCartUI();
    }
}

window.decreaseQuantity = function (productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        if (cart[itemIndex].quantity > 1) { cart[itemIndex].quantity -= 1; }
        else { cart.splice(itemIndex, 1); }
        updateProductActionUI(productId);
        updateCartUI();
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

function updateCartUI() {
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
        div.innerHTML = `
            <img src="${item.img}" alt="img" class="cart-item-img">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">₹${item.sellingPrice}</div>
            </div>
            <div class="qty-controls">
                <button class="btn-qty" onclick="window.decreaseQuantity('${item.id}')">-</button>
                <span class="qty-count">${item.quantity}</span>
                <button class="btn-qty" onclick="window.addToCart('${item.id}')">+</button>
            </div>
        `;
        container.appendChild(div);
    });
}


// ==========================================
// 🔐 3. FIREBASE OTP LOGIN & AUTH LOGIC
// ==========================================

let recaptchaWidgetId = null; // 🌟 NAYA: Widget ID store karne ke liye

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

    // 🌟 NAYA: reCAPTCHA ko sirf ek baar banayenge jab modal khulega, taaki usko load hone ka time mil sake
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible'
        });
        window.recaptchaVerifier.render().then((widgetId) => {
            recaptchaWidgetId = widgetId;
        });
    } else if (recaptchaWidgetId !== null) {
        // Agar pehle se bana hai, toh purane cache ko clear karne ke liye reset karenge
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

// 📱 OTP Bhejne Ka Function
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

    // Seedha SMS bhejenge kyunki reCAPTCHA background me pehle hi ready ho chuka hai
    signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier)
        .then((confirmationResult) => {
            // SMS chala gaya!
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

            // 🚨 Error aane par reCAPTCHA ko smoothly reset karenge
            if (recaptchaWidgetId !== null) {
                try {
                    grecaptcha.reset(recaptchaWidgetId);
                } catch (e) { }
            }
        });
}

// 🔑 OTP Verify Karne Ka Function
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
        const user = result.user; // Login successful!

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
// 💳 4. PREMIUM CHECKOUT LOGIC
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

window.renderCheckoutPage = async function () {
    const container = document.getElementById('checkout-content-container');
    container.innerHTML = '<p style="text-align:center; padding: 20px;">Loading Secure Checkout...</p>';

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
    let finalAmount = sellingTotal - checkoutState.couponDiscount;

    let addressHtml = ``;
    let activeAddressDisplay = `Select / Add Delivery Address`;

    if (savedAddresses.length > 0) {
        if (checkoutState.selectedAddressIndex >= savedAddresses.length) checkoutState.selectedAddressIndex = 0;
        let activeAddr = savedAddresses[checkoutState.selectedAddressIndex];

        if (typeof activeAddr === 'object') {
            activeAddressDisplay = `${activeAddr.building}, ${activeAddr.area}, ${activeAddr.city} - ${activeAddr.pincode}`;
        } else {
            activeAddressDisplay = activeAddr.substring(0, 40) + '...';
        }

        addressHtml += `<button style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; background:#fff; border:1px dashed #128c7e; color:#128c7e; font-weight:bold;" onclick="openNewAddressModal('checkout')">+ Add New Address</button>`;

        savedAddresses.forEach((addr, idx) => {
            let isChecked = idx === checkoutState.selectedAddressIndex ? 'checked' : '';
            let isSelectedClass = idx === checkoutState.selectedAddressIndex ? 'selected' : '';

            let addrText = typeof addr === 'object' ?
                `<strong>${addr.fullName}</strong> (${addr.type || 'Home'})<br>${addr.building}, ${addr.area}, ${addr.city}, ${addr.state} - ${addr.pincode}`
                : addr;

            addressHtml += `
                <label class="address-radio-label ${isSelectedClass}" onclick="checkoutState.selectedAddressIndex = ${idx}; renderCheckoutPage();">
                    <div style="font-size:13px; color:#444; line-height:1.4;">${addrText}</div>
                    <input type="radio" name="addressSelect" class="radio-custom" ${isChecked}>
                </label>
            `;
        });
    } else {
        addressHtml = `
            <div style="text-align:center; padding:15px;">
                <p style="font-size:13px; color:#666; margin-bottom:10px;">No saved addresses found.</p>
                <button class="btn-checkout" onclick="openNewAddressModal('checkout')">Add New Address</button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="chk-section">
            <div class="chk-header" onclick="toggleChkBody('chk-body-address')">
                <div class="chk-header-left"><span class="chk-header-icon">📍</span> Delivery Address</div>
                <div class="chk-header-right">✎ Edit</div>
            </div>
            <div class="saved-address-box" id="chk-display-address">${activeAddressDisplay}</div>
            <div class="chk-body" id="chk-body-address">${addressHtml}</div>
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
                <div class="chk-header-left"><span class="chk-header-icon">🏷️</span> Coupons</div>
                <div class="chk-header-right">${checkoutState.couponDiscount > 0 ? 'Applied ✅' : '0+ available ➔'}</div>
            </div>
            <div class="chk-body" id="chk-body-coupon">
                <div class="coupon-input-box">
                    <input type="text" id="couponInputText" placeholder="Enter Coupon Code" value="${checkoutState.couponCode}">
                    <button onclick="applyCoupon()">APPLY</button>
                </div>
                ${checkoutState.couponDiscount > 0 ? `<p style="color:#1e8354; font-size:12px; margin-top:8px;">Coupon Applied! You saved ₹${checkoutState.couponDiscount}</p>` : ''}
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
                <div class="price-row discount"><span>Coupon Discount</span><span>-₹${checkoutState.couponDiscount}</span></div>
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
                <label class="address-radio-label ${checkoutState.paymentMethod === 'COD' ? 'selected' : ''}" onclick="checkoutState.paymentMethod='COD'; renderCheckoutPage();">
                    <div><strong style="color:#111; font-size:14px;">🚚 Cash on delivery</strong><br><span style="color:#666; font-size:12px;">Pay with cash</span></div>
                    <input type="radio" name="paySelect" class="radio-custom" ${checkoutState.paymentMethod === 'COD' ? 'checked' : ''}>
                </label>
                <label class="address-radio-label ${checkoutState.paymentMethod === 'UPI' ? 'selected' : ''}" onclick="checkoutState.paymentMethod='UPI'; renderCheckoutPage();">
                    <div><strong style="color:#111; font-size:14px;">📱 Pay via UPI</strong><br><span style="color:#666; font-size:12px;">Use any registered UPI ID</span></div>
                    <input type="radio" name="paySelect" class="radio-custom" ${checkoutState.paymentMethod === 'UPI' ? 'checked' : ''}>
                </label>
            </div>
        </div>
    `;
}

window.toggleChkBody = function (id) {
    const el = document.getElementById(id);
    if (el.classList.contains('active')) el.classList.remove('active');
    else el.classList.add('active');
}

window.applyCoupon = function () {
    const code = document.getElementById('couponInputText').value.toUpperCase().trim();
    if (code === 'WELCOME50') {
        checkoutState.couponCode = code;
        checkoutState.couponDiscount = 50;
        renderCheckoutPage();
    } else {
        alert("Invalid or Expired Coupon Code!");
        checkoutState.couponCode = '';
        checkoutState.couponDiscount = 0;
        renderCheckoutPage();
    }
}

window.finalizeOrder = async function () {
    if (cart.length === 0) return;

    const btn = document.querySelector('.checkout-bar .btn-checkout');
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

        await addDoc(collection(db, "orders"), orderData);

        let message = `Hello! New Order Received 🛍️\n\n`;
        message += `*Customer:* +91 ${loggedInUser}\n`;

        let addrStr = typeof selectedAddress === 'object' ?
            `${selectedAddress.fullName}, ${selectedAddress.building}, ${selectedAddress.area}, ${selectedAddress.city} - ${selectedAddress.pincode} (${selectedAddress.type})`
            : selectedAddress;

        message += `*Address:* ${addrStr}\n`;
        message += `*Payment:* ${checkoutState.paymentMethod}\n\n*Order Details:*\n`;

        cart.forEach(item => {
            message += `▪️ ${item.name}\n   Qty: ${item.quantity} x ₹${item.sellingPrice} = ₹${parseFloat(item.sellingPrice) * item.quantity}\n\n`;
        });

        if (checkoutState.couponDiscount > 0) message += `*Coupon Discount:* -₹${checkoutState.couponDiscount}\n`;
        message += `*Final Amount:* ₹${finalGrandTotal}`;

        cart = [];
        updateCartUI();
        closeCheckoutPage();
        checkoutState = { selectedAddressIndex: 0, paymentMethod: 'COD', couponCode: '', couponDiscount: 0 };

        const myWhatsAppNumber = "919876543210"; // <--- YAHAN APNA NUMBER DAALEIN
        window.open(`https://wa.me/${myWhatsAppNumber}?text=${encodeURIComponent(message)}`, '_blank');

        btn.innerText = "Proceed to pay"; btn.disabled = false;

    } catch (error) {
        alert("Order error: " + error.message);
        btn.innerText = "Proceed to pay"; btn.disabled = false;
    }
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

// --- 📦 ORDER HISTORY (WITH LIVE SYNC & CANCEL FEATURE) ---

let unsubscribeOrders = null; // Live sync ko track karne ke liye

window.renderMyOrders = function () {
    currentProfileScreen = 'orders';
    document.getElementById('profile-title').innerText = "Your Orders";
    const container = document.getElementById('profile-content-container');
    container.innerHTML = '<p style="text-align:center; padding: 30px;">Loading your orders...</p>';

    try {
        const q = query(collection(db, "orders"), where("customerMobile", "==", loggedInUser));

        // Agar pehle se koi listener chal raha hai, toh usko band karein (memory bachaane ke liye)
        if (unsubscribeOrders) {
            unsubscribeOrders();
        }

        // 🌟 NAYA: 'onSnapshot' lagaya gaya hai real-time live sync ke liye
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

                // 🌟 NAYA: Order Cancel button logic (Sirf New ya Processing state mein dikhega)
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

            // UI sirf tabhi update karein jab customer "Orders" screen par ho
            if (currentProfileScreen === 'orders') {
                container.innerHTML = html;
            }
        });
    } catch (error) {
        container.innerHTML = '<p style="text-align:center; color:red;">Failed to load orders.</p>';
    }
}

// 🌟 NAYA FUNCTION: Order Cancel Karne ke liye
window.cancelOrder = async function (orderId) {
    if (confirm("Are you sure you want to cancel this order?")) {
        try {
            await updateDoc(doc(db, "orders", orderId), {
                status: "Cancelled"
            });
            // onSnapshot laga hua hai, isliye status automatically update ho jayega bina refresh kiye
            alert("Order cancelled successfully!");
        } catch (error) {
            alert("Error cancelling order: " + error.message);
        }
    }
}

// Inline details accordion
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

// Wapas cart me bhej kar reorder karna
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
                            <span style="color:#128c7e; margin-right: 20px; cursor:pointer;" onclick="editAddress(${idx}, 'profile')">✏️ Edit</span>
                            <span style="color:#dc3545; cursor:pointer;" onclick="deleteAddress(${idx})">🗑️ Delete</span>
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
                    <input type="email" id="addrEmail" class="addr-input" placeholder="Email Address *">
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
    const email = document.getElementById('addrEmail').value.trim();
    const building = document.getElementById('addrBuilding').value.trim();
    const area = document.getElementById('addrArea').value.trim();
    const state = document.getElementById('addrState').value.trim();
    const city = document.getElementById('addrCity').value.trim();
    const pincode = document.getElementById('addrPincode').value.trim();
    const type = document.getElementById('addrTypeSelected').value;
    const editIdx = document.getElementById('editAddressIdx').value;

    if (!fullName || !building || !area || !state || !city || !pincode) {
        alert("Please fill all required (*) fields");
        return;
    }

    const btn = document.getElementById('addrSubmitBtn');
    btn.innerText = "Saving..."; btn.disabled = true;

    const newAddressObj = { fullName, email, building, area, state, city, pincode, type };
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

// ==========================================
// 🚀 INITIALIZE APP
// ==========================================
listenProducts();