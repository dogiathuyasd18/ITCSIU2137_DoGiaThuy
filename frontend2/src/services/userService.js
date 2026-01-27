import axios from "axios";

const handleLoginAPI = async (email, password) => {
    try {
        // this.props.navigate('/');
        const res = await axios.post("http://localhost:8080/api/login", {
            email: email,
            password: password,
        });
        console.log("Login success from userService frontend:", res.data);
        // alert("Success from userService");
        return res.data;
    } catch (err) {
        console.error("Login error:", err.response?.data || err.message);
        // Return the error response from the server, or a default error
        return err.response?.data || {
            errCode: 500,
            message: "Login failed. Please try again."
        };
    }
};

const handleRegisterAPI = (data) => {
    return axios.post("http://localhost:8080/api/register", data);
};

const handleSurveyAPI = async (data) => {
    try {
        const token = localStorage.getItem("access_token");
        const url = `http://localhost:8080/api/survey`
        const res = await axios.post(url, data, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        console.log("From HandleSurvey:", res.data);
        return res.data;
    } catch (error) {
        console.error("Error in HandleSurvey:", error);
        throw error;
    }
}

const getReviewableProducts = async () => {
    try {
        const token = localStorage.getItem("access_token");
        const url = `http://localhost:8080/api/reviewable-products`
        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        return res.data;
    } catch (error) {
        console.error("Error in getReviewableProducts:", error);
        throw error;
    }
}

export default {
    handleLoginAPI,
    handleRegisterAPI,
    handleSurveyAPI,
    getReviewableProducts
};
