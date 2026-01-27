import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Header from '../components/Header/Header';
import HomePage from './Information/HomePage';
import Login from './Auth/Login';
import ProductDetails from './Information/ProductDetails';
import About from './Information/About';
import BarChart from './Admin/BarChart';
import Register from './Auth/Register';
import Admin from './Admin/Admin';
import Unauthorized from './Information/Unauthorized';
import BookingsList from './Booking/BookingsList';
import BookingForm from './Booking/BookingForm';
import BookingDetail from './Booking/BookingDetail';
import ProtectedRoute, { AdminRoute, CustomerRoute, PublicRoute, AuthRoute } from '../components/ProtectedRoute';
import Survey from './Booking/Survey';

class App extends Component {
  render() {
    return (
      <AuthProvider>
        <Router>
          <div className="App">
            <Header />
            <main className="main-content">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} exact />
                <Route path="/products" element={<ProductDetails />} />
                <Route path="/tours" element={<ProductDetails />} />
                <Route path="/about" element={<About />} />
                
                {/* Authentication Routes */}
                <Route path="/login" element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } />
                <Route path="/register" element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } />
                
                {/* Booking Routes */}
                <Route path="/bookings" element={
                  <AuthRoute>
                    <BookingsList />
                  </AuthRoute>
                } />
                <Route path="/booking/new" element={
                  <AuthRoute>
                    <BookingForm />
                  </AuthRoute>
                } />
                <Route path="/survey" element={
                  <AuthRoute>
                    <Survey />
                  </AuthRoute>
                } />
                <Route path="/booking/:id" element={
                  <AuthRoute>
                    <BookingDetail />
                  </AuthRoute>
                } />
                
                {/* Protected Routes */}
                <Route path="/chart" element={
                  <AdminRoute>
                    <BarChart />
                  </AdminRoute>
                } />
                
                <Route path="/admin/*" element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                } />
                <Route path="/unauthorized" element={<Unauthorized />} />
              </Routes>
              
            </main>
          </div>
        </Router>
      </AuthProvider>
    );
  }
}

export default App;
