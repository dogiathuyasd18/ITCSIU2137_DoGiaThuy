import p1_img from "./product_1.png";
import p2_img from "./product_2.png";
import p3_img from "./product_3.png";
import p4_img from "./product_4.png";
import p5_img from "./product_5.png";
import p6_img from "./product_6.png";
import p7_img from "./product_7.png";

let all_product_items = [
  {
    stock_keeping_unit: 2001,
    quantity_in_stock: 20,
    price: 599.00,
    product_id: 1, 
    image: p1_img,
    name: "Sapa Scenic Hills Tour",
    description: "3-day guided tour through the scenic hills of Sapa. Includes lodging, meals, and local cultural experiences.",
    category: "Adventure Tours"
  },
  {
    stock_keeping_unit: 2002,
    quantity_in_stock: 15,
    price: 850.00,
    product_id: 2, 
    image: p2_img,
    name: "Luxury Halong Bay Cruise",
    description: "Luxury Halong Bay cruise with ocean-view cabins, gourmet dining, and kayaking excursions.",
    category: "Cruises"
  },
  {
    stock_keeping_unit: 2003,
    quantity_in_stock: 25,
    price: 320.00,
    product_id: 3, 
    image: p3_img,
    name: "Cu Chi Tunnels & Mekong Delta Day Trip",
    description: "Day trip to the Cu Chi Tunnels and Mekong Delta with boat ride, lunch, and English-speaking guide.",
    category: "Day Trips"
  },
  {
    stock_keeping_unit: 2004,
    quantity_in_stock: 16,
    price: 450.00,
    product_id: 4, 
    image: p4_img,
    name: "Da Lat Adventure Package",
    description: "Adventure package to Da Lat including canyoning, trekking, and a 2-night stay at a forest resort.",
    category: "Adventure Tours"
  },
  {
    stock_keeping_unit: 2005,
    quantity_in_stock: 18,
    price: 720.00,
    product_id: 5, 
    image: p5_img,
    name: "Phu Quoc Romantic Getaway",
    description: "Romantic getaway to Phu Quoc island with beachfront resort, snorkeling, and sunset cruise.",
    category: "Beach Getaways"
  },
  {
    stock_keeping_unit: 2006,
    quantity_in_stock: 30,
    price: 180.00,
    product_id: 6, 
    image: p6_img,
    name: "Essential Travel Gear Bundle",
    description: "Essential travel gear bundle including a waterproof backpack, quick-dry towel, and travel pillow.",
    category: "Travel Gear"
  },
  {
    stock_keeping_unit: 2007,
    quantity_in_stock: 22,
    price: 99.00,
    product_id: 7, 
    image: p7_img,
    name: "Hanoi Street Food Walking Tour",
    description: "Vietnamese street food walking tour in Hanoi Old Quarter, featuring 8 unique dishes and local beer tasting.",
    category: "Food Tours"
  },
];

export default all_product_items;