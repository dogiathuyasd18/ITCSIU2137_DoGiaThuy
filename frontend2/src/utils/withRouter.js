// utils/withRouter.js (React Router v6)
import { useNavigate, useLocation, useParams } from 'react-router-dom';

export function withRouter(Component) {
    return (props) => {
        const navigate = useNavigate();
        const location = useLocation();
        const params = useParams();
        return <Component {...props} router={{ navigate, location, params }} />;
    };
}
