import { Route, Routes } from 'react-router-dom';
import DashBoard from '../../components/Home/Dashboard'
import Products from "./Products";
import Users from "./Users";
import Analytics from "./Analytics";
import  {Update}  from "./Update";
import { UpdateProduct } from "./UpdateProduct";
import '../../assets/styles/Admin.scss'
import Orders from "./Orders";
import { UpdateDetail } from "./UpdateDetails";



const Admin = () => {
    return (
        <div className="admin-container">
            <div className="admin-content">
                <Routes>
                    <Route index element={<DashBoard />} />
                    <Route path="products" element={<Products/>}/>
                    <Route path="users" element={<Users/>}/>
                    <Route path="analytics" element={<Analytics/>}/>
                    <Route path="update" element={<Update/>}/>
                    <Route path="update-product" element={<UpdateProduct/>}/>
                    <Route path="orders" element={<Orders/>}/>
                    <Route path="update-detail" element={<UpdateDetail/>}/>
                </Routes>
            </div>
        </div>
    )
}

export default Admin
