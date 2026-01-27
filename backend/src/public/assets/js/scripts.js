const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

/**
 * Hàm tải template
 *
 * Cách dùng:
 * <div id="parent"></div>
 * <script>
 *  load("#parent", "./path-to-template.html");
 * </script>
 */
function load(selector, path) {
    const cached = localStorage.getItem(path);
    if (cached) {
        $(selector).innerHTML = cached;
    }

    fetch(path)
        .then((res) => res.text())
        .then((html) => {
            if (html !== cached) {
                $(selector).innerHTML = html;
                localStorage.setItem(path, html);
            }
        })
        .finally(() => {
            window.dispatchEvent(new Event("template-loaded"));
        });
}

/**
 * Hàm kiểm tra một phần tử
 * có bị ẩn bởi display: none không
 */
function isHidden(element) {
    if (!element) return true;

    if (window.getComputedStyle(element).display === "none") {
        return true;
    }

    let parent = element.parentElement;
    while (parent) {
        if (window.getComputedStyle(parent).display === "none") {
            return true;
        }
        parent = parent.parentElement;
    }

    return false;
}

/**
 * Hàm buộc một hành động phải đợi
 * sau một khoảng thời gian mới được thực thi
 */
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args);
        }, timeout);
    };
}

/**
 * Hàm tính toán vị trí arrow cho dropdown
 *
 * Cách dùng:
 * 1. Thêm class "js-dropdown-list" vào thẻ ul cấp 1
 * 2. CSS "left" cho arrow qua biến "--arrow-left-pos"
 */
const calArrowPos = debounce(() => {
    if (isHidden($(".js-dropdown-list"))) return;

    const items = $$(".js-dropdown-list > li");

    items.forEach((item) => {
        const arrowPos = item.offsetLeft + item.offsetWidth / 2;
        item.style.setProperty("--arrow-left-pos", `${arrowPos}px`);
    });
});

// Tính toán lại vị trí arrow khi resize trình duyệt
window.addEventListener("resize", calArrowPos);

// Tính toán lại vị trí arrow sau khi tải template
window.addEventListener("template-loaded", calArrowPos);

/**
 * Giữ active menu khi hover
 *
 * Cách dùng:
 * 1. Thêm class "js-menu-list" vào thẻ ul menu chính
 * 2. Thêm class "js-dropdown" vào class "dropdown" hiện tại
 *  nếu muốn reset lại item active khi ẩn menu
 */
window.addEventListener("template-loaded", handleActiveMenu);

function handleActiveMenu() {
    const dropdowns = $$(".js-dropdown");
    const menus = $$(".js-menu-list");
    const activeClass = "menu-column__item--active";

    const removeActive = (menu) => {
        menu.querySelector(`.${activeClass}`)?.classList.remove(activeClass);
    };

    const init = () => {
        menus.forEach((menu) => {
            const items = menu.children;
            if (!items.length) return;

            removeActive(menu);
            if (window.innerWidth > 991) items[0].classList.add(activeClass);

            Array.from(items).forEach((item) => {
                item.onmouseenter = () => {
                    if (window.innerWidth <= 991) return;
                    removeActive(menu);
                    item.classList.add(activeClass);
                };
                item.onclick = () => {
                    if (window.innerWidth > 991) return;
                    removeActive(menu);
                    item.classList.add(activeClass);
                    item.scrollIntoView();
                };
            });
        });
    };

    init();

    dropdowns.forEach((dropdown) => {
        dropdown.onmouseleave = () => init();
    });
}

/**
 * JS toggle
 *
 * Cách dùng:
 * <button class="js-toggle" toggle-target="#box">Click</button>
 * <div id="box">Content show/hide</div>
 */
window.addEventListener("template-loaded", initJsToggle);

function initJsToggle() {
    $$(".js-toggle").forEach((button) => {
        const target = button.getAttribute("toggle-target");
        if (!target) {
            document.body.innerText = `Cần thêm toggle-target cho: ${button.outerHTML}`;
        }
        button.onclick = (e) => {
            e.preventDefault();

            if (!$(target)) {
                return (document.body.innerText = `Không tìm thấy phần tử "${target}"`);
            }
            const isHidden = $(target).classList.contains("hide");

            requestAnimationFrame(() => {
                $(target).classList.toggle("hide", !isHidden);
                $(target).classList.toggle("show", isHidden);
            });
        };
        document.onclick = function (e) {
            if (!e.target.closest(target)) {
                const isHidden = $(target).classList.contains("hide");
                if (!isHidden) {
                    button.click();
                }
            }
        };
    });
}

window.addEventListener("template-loaded", () => {
    const links = $$(".js-dropdown-list > li > a");

    links.forEach((link) => {
        link.onclick = () => {
            if (window.innerWidth > 991) return;
            const item = link.closest("li");
            item.classList.toggle("navbar__item--active");
        };
    });
});

window.addEventListener("template-loaded", () => {
    const tabsSelector = "prod-tab__item";
    const contentsSelector = "prod-tab__content";

    const tabActive = `${tabsSelector}--current`;
    const contentActive = `${contentsSelector}--current`;

    const tabContainers = $$(".js-tabs");
    tabContainers.forEach((tabContainer) => {
        const tabs = tabContainer.querySelectorAll(`.${tabsSelector}`);
        const contents = tabContainer.querySelectorAll(`.${contentsSelector}`);
        tabs.forEach((tab, index) => {
            tab.onclick = () => {
                tabContainer.querySelector(`.${tabActive}`)?.classList.remove(tabActive);
                tabContainer.querySelector(`.${contentActive}`)?.classList.remove(contentActive);
                tab.classList.add(tabActive);
                contents[index].classList.add(contentActive);
            };
        });
    });
});

window.addEventListener("template-loaded", () => {
    const switchBtn = document.querySelector("#switch-theme-btn");
    if (switchBtn) {
        switchBtn.onclick = function () {
            const isDark = localStorage.dark === "true";
            document.querySelector("html").classList.toggle("dark", !isDark);
            localStorage.setItem("dark", !isDark);
            switchBtn.querySelector("span").textContent = isDark ? "Dark mode" : "Light mode";
        };
        const isDark = localStorage.dark === "true";
        switchBtn.querySelector("span").textContent = isDark ? "Light mode" : "Dark mode";
    }
});

const isDark = localStorage.dark === "true";
document.querySelector("html").classList.toggle("dark", isDark);

document.addEventListener('DOMContentLoaded', function () {
    // Function to handle quantity changes
    function changeQuantity(itemId, delta) {
        const item = document.querySelector(`[data-item="${itemId}"]`);
        const quantityEl = item.querySelector('.quantity');
        const totalPriceEl = item.querySelector('.cart-item__total-price');
        const price = parseFloat(item.dataset.price);

        // Update the quantity
        let quantity = parseInt(quantityEl.innerText) + delta;
        if (quantity < 1) {
            quantity = 0; // Minimum quantity is 0
        }
        quantityEl.innerText = quantity;

        // Update the total price for this item
        const totalItemPrice = quantity * price;
        totalPriceEl.innerText = `$${totalItemPrice.toFixed(2)}`;

        // Recalculate subtotal and total
        updateCartTotals();
    }

    // Function to calculate subtotal and total
    function updateCartTotals() {
        let subtotal = 0;

        // Sum up the total prices of all items
        document.querySelectorAll('.cart-item').forEach((item) => {
            const quantity = parseInt(item.querySelector('.quantity').innerText);
            const price = parseFloat(item.dataset.price);
            subtotal += quantity * price;
        });

        // Update subtotal and total in the UI
        document.getElementById('subtotal').innerText = `$${subtotal.toFixed(2)}`;

        // Add shipping fee (fixed at $10 for this example)
        const total = subtotal + 10;
        document.getElementById('total').innerText = `$${total.toFixed(2)}`;

        // Update the hidden input with the new subtotal
        const hiddenSubtotalInput = document.querySelector('input[name="subtotal"]');
        if (hiddenSubtotalInput) {
            hiddenSubtotalInput.value = subtotal.toFixed(2); // Set the value of the hidden input field
        }

        // Update the hidden input with the new total
        const hiddenTotalInput = document.querySelector('input[name="total"]');
        if (hiddenTotalInput) {
            hiddenTotalInput.value = total.toFixed(2); // Set the value of the hidden input field
        }
    }

    // Event listeners for quantity buttons (decrease and increase)
    document.querySelectorAll('.decrease').forEach(button => {
        button.addEventListener('click', function (event) {
            event.preventDefault(); // Prevent form submission
            const itemId = button.getAttribute('data-item');
            changeQuantity(itemId, -1); // Decrease quantity
        });
    });

    document.querySelectorAll('.increase').forEach(button => {
        button.addEventListener('click', function (event) {
            event.preventDefault(); // Prevent form submission
            const itemId = button.getAttribute('data-item');
            changeQuantity(itemId, 1); // Increase quantity
        });
    });

    // Event listener for remove item buttons
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', function () {
            const itemId = button.getAttribute('data-item');
            removeItemFromCart(itemId);
        });
    });

    // Function to remove an item from the cart
    function removeItemFromCart(itemId) {
        const item = document.querySelector(`[data-item="${itemId}"]`);
        item.remove(); // Remove the item from the DOM

        // Recalculate the cart totals after removal
        updateCartTotals();
    }

    // Initial cart total calculation on page load
    updateCartTotals();

    // Now let's attach the event listener to the Proceed to Checkout button
    const checkoutButton = document.getElementById('checkoutForm');
    
    checkoutButton.addEventListener('click', async function (event) {
        event.preventDefault(); // Prevent form submission from button

        // Prepare data from the form
        const total = document.getElementById('total').innerText.replace('$', '');
        const shipping = document.querySelector('input[name="shipping"]').value;
        const subtotal = document.getElementById('subtotal').innerText.replace('$', '');

        // Collect cart items (from cart details function)
        const cartItems = [];

        document.querySelectorAll('.cart-item').forEach((item) => {
            const quantity = parseInt(item.querySelector('.quantity').innerText);
            const title = item.querySelector('.cart-item__title').innerText;
            const price = parseFloat(item.dataset.price);
            const totalPrice = quantity * price;

            cartItems.push({
                title: title,
                quantity: quantity,
                price: price.toFixed(2),
                totalPrice: totalPrice.toFixed(2),
            });
        });

        // Now submit the data to the server
        const response = await fetch('/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                total: total,
                shipping: shipping,
                subtotal: subtotal,
                cartItem: JSON.stringify(cartItems)
            })
        });

        // Handle the response
        const result = await response.json();
        console.log(result); // You can use this result to redirect or show confirmation on the client side
    });
});

document.addEventListener('DOMContentLoaded', function () {
    // Get the checkout form and button
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutButton = document.getElementById('checkoutButton');

    if (checkoutButton) {
        checkoutButton.addEventListener('click', function (event) {
            event.preventDefault(); // Prevent the default form submission

            // Prepare the form data (subtotal, total, shipping, cart items)
            const total = document.getElementById('total').innerText.replace('$', '');
            const shipping = document.querySelector('input[name="shipping"]').value;
            const subtotal = document.getElementById('subtotal').innerText.replace('$', '');
            
            // Prepare cart items from the page
            const cartItems = [];
            document.querySelectorAll('.cart-item').forEach(item => {
                const quantity = parseInt(item.querySelector('.quantity').innerText);
                const title = item.querySelector('.cart-item__title').innerText;
                const price = parseFloat(item.dataset.price);
                const totalPrice = quantity * price;
                
                cartItems.push({
                    title: title,
                    quantity: quantity,
                    price: price.toFixed(2),
                    totalPrice: totalPrice.toFixed(2)
                });
            });

            // Attach the data as hidden inputs to the form
            const hiddenTotalInput = document.createElement('input');
            hiddenTotalInput.type = 'hidden';
            hiddenTotalInput.name = 'total';
            hiddenTotalInput.value = total;
            checkoutForm.appendChild(hiddenTotalInput);

            const hiddenShippingInput = document.createElement('input');
            hiddenShippingInput.type = 'hidden';
            hiddenShippingInput.name = 'shipping';
            hiddenShippingInput.value = shipping;
            checkoutForm.appendChild(hiddenShippingInput);

            const hiddenSubtotalInput = document.createElement('input');
            hiddenSubtotalInput.type = 'hidden';
            hiddenSubtotalInput.name = 'subtotal';
            hiddenSubtotalInput.value = subtotal;
            checkoutForm.appendChild(hiddenSubtotalInput);

            const hiddenCartItemsInput = document.createElement('input');
            hiddenCartItemsInput.type = 'hidden';
            hiddenCartItemsInput.name = 'cartItem';
            hiddenCartItemsInput.value = JSON.stringify(cartItems);
            checkoutForm.appendChild(hiddenCartItemsInput);

            // Submit the form programmatically
            checkoutForm.submit();
        });
    } else {
        console.error('Checkout button not found.');
    }
});

