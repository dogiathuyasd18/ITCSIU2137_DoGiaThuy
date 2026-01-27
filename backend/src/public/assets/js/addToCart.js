// // Sample product data
// const product = [
//     {
//         id: 0,
//         image: 'image.jpg',
//         title: 'Apple',
//         price: 100,
//     }, 
//     {
//         id: 1,
//         image: 'image.jpg',
//         title: 'Banana',
//         price: 100,
//     }, 
//     {
//         id: 2,
//         image: 'image.jpg',
//         title: 'Watermelon',
//         price: 100,
//     }, 
//     {
//         id: 3,
//         image: 'image.jpg',
//         title: 'Orange',
//         price: 100,
//     }, 
// ];

// // To hold the cart items
// var cart = [];

// // Function to add items to the cart
// function addToCart(productId) {
//     // Find the product by ID
//     const item = product.find(p => p.id === productId);
//     if (item) {
//         // Add a copy of the product item to the cart
//         cart.push({...item});
//         displayCart();  // Update the cart view
//     }
// }

// // Function to display the cart
// function displayCart() {
//     const cartContainer = document.getElementById('cartItems');
    
//     if (cart.length === 0) {
//         cartContainer.innerHTML = "<p>Your cart is empty.</p>";
//     } else {
//         // Map through the cart items and create HTML content
//         cartContainer.innerHTML = cart.map((item, index) => {
//             return `
//                 <div class="cart-item">
//                     <div class="row-img">
//                         <img class="rowing" src="${item.image}" alt="${item.title}">
//                     </div>
//                     <p style="font-size:12px">${item.title}</p>
//                     <h2 style="font-size:15px">$${item.price}.00</h2>
//                     <button onclick="removeFromCart(${index})">Remove</button>
//                 </div>
//             `;
//         }).join('');
//     }
// }

// // Function to remove item from the cart
// function removeFromCart(index) {
//     cart.splice(index, 1);
//     displayCart();  // Update the cart view after removal
// }

// // Initial render for the product listing page
// function renderProductList() {
//     const root = document.getElementById('root');
    
//     // Map through the products and generate HTML for each
//     root.innerHTML = product.map((item) => {
//         return `
//             <div class="box">
//                 <div class="img-box">
//                     <img class="images" src="${item.image}" alt="${item.title}">
//                 </div>
//                 <div class="bottom">
//                     <p>${item.title}</p>
//                     <h2>$${item.price}.00</h2>
//                     <button onclick="addToCart(${item.id})">Add to cart</button>
//                 </div>
//             </div>
//         `;
//     }).join('');
// }

// // Call the renderProductList function to display products when the page loads
// document.addEventListener('DOMContentLoaded', renderProductList);

// function updateCartSummary() {
//     const subtotal = cart.reduce((total, item) => total + item.price, 0);
//     const shipping = 10;  // Fixed shipping cost
//     const total = subtotal + shipping;

//     document.getElementById('cartSubtotal').innerText = `$${subtotal}.00`;
//     document.getElementById('cartTotal').innerText = `$${total}.00`;
// }

// // Update cart summary when cart changes
// function displayCart() {
//     const cartContainer = document.getElementById('cartItems');
    
//     if (cart.length === 0) {
//         cartContainer.innerHTML = "<p>Your cart is empty.</p>";
//     } else {
//         cartContainer.innerHTML = cart.map((item, index) => {
//             return `
//                 <div class="cart-item">
//                     <div class="row-img">
//                         <img class="rowing" src="${item.image}" alt="${item.title}">
//                     </div>
//                     <p style="font-size:12px">${item.title}</p>
//                     <h2 style="font-size:15px">$${item.price}.00</h2>
//                     <button onclick="removeFromCart(${index})">Remove</button>
//                 </div>
//             `;
//         }).join('');
//     }

//     updateCartSummary();  // Update the summary after displaying the cart
// }
// app.get('/checkout', (req, res) => {
//     const cartItems = [
//         { name: 'Item 1', price: 47.0, quantity: 1 },
//         { name: 'Item 2', price: 53.0, quantity: 2 },
//         { name: 'Item 3', price: 38.65, quantity: 1 }
//     ];

//     // Calculate total
//     const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

//     // Pass total to checkout.ejs
//     res.render('checkout', { total });
// });
