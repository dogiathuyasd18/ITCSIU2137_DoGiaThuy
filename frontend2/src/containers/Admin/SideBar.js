import { ProSidebar, Menu, MenuItem} from 'react-pro-sidebar';
import { FaGem, FaHeart, FaEdit, FaChartBar, FaBox, FaUsers } from 'react-icons/fa'
import { Link, useLocation } from 'react-router-dom'
import '../../assets/styles/SideBar.scss'

const SideBar = ({ collapsed, toggleSidebar }) => {
    const location = useLocation();

    return (
        <ProSidebar collapsed={collapsed}>
            <Menu>
                <MenuItem 
                    icon={<FaGem />}
                    active={location.pathname === '/admin' || location.pathname === '/admin/'}
                >
                    <Link to="/admin">Dashboard</Link>
                </MenuItem>
                <MenuItem 
                    icon={<FaBox />}
                    active={location.pathname === '/admin/products'}
                >
                    <Link to="/admin/products">Products</Link>
                </MenuItem>
                <MenuItem 
                    icon={<FaUsers />}
                    active={location.pathname === '/admin/users'}
                >
                    <Link to="/admin/users">Users</Link>
                </MenuItem>
                <MenuItem 
                    icon={<FaChartBar />}
                    active={location.pathname === '/admin/analytics'}
                >
                    <Link to="/admin/analytics">Analytics</Link>
                </MenuItem>
                <MenuItem 
                    icon={<FaEdit />}
                    active={location.pathname === '/admin/update'}
                >
                    <Link to="/admin/update">Update</Link>
                </MenuItem>
                
            </Menu>
        </ProSidebar>
    )
}

export default SideBar;