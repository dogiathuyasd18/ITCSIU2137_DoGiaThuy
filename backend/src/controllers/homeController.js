import db from '../models/index.js';



let profile = (req,res) => {
    return res.render('profile.ejs')
}

let productDetail = (req,res) => {
    return res.render('product-detail.ejs')
}




export default {
    profile: profile,
    productDetail : productDetail,
}