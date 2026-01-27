import axios from "axios";

const instance = axios.create({
    baseURL: "http://localhost:8080/"
})

// Add a response interceptor
instance.interceptors.response.use(function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    config.headers.Authorization = `Bearer ${localStorage.getItem("access_token")}`;
    // return response.data;
    return config;
  }, function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    return Promise.reject(error);
  });