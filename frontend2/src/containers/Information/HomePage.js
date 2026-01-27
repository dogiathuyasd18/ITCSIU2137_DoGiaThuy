import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/styles/HomePage.scss';
import { getProducts } from '../../services/bookingService';
// import Nav from '../Header/Nav'
const HomePage = () => {
  const navigate = useNavigate();
  const [tours, setTours] = useState([]);
  const [toursLoading, setToursLoading] = useState(true);
  const [toursError, setToursError] = useState('');

  const heroScrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const loadTours = async () => {
      try {
        setToursLoading(true);
        setToursError('');
        const res = await getProducts();
        if (res?.errCode === 0 && Array.isArray(res.products)) {
          setTours(res.products);
        } else {
          setTours([]);
          setToursError(res?.message || 'Failed to load tours.');
        }
      } catch (e) {
        console.error('HomePage: failed to load tours', e);
        setTours([]);
        setToursError('Failed to load tours. Please try again.');
      } finally {
        setToursLoading(false);
      }
    };
    loadTours();
  }, []);

  const popularTours = useMemo(() => tours.slice(0, 3), [tours]);
  const tourImages = [
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=900&q=80',
  ];

  return (
    <>
    {/* <Nav/> */}
      <div>
        <section className="hero" role="banner">
          <div className="hero-content">
            <h1>Discover Your Next Adventure</h1>
            <p>Travel to breathtaking destinations around the world with unforgettable tours and experiences.</p>
            <button
              className="btn-primary"
              onClick={() => heroScrollTo('destinations')}
              aria-label="Explore Destinations"
            >
              Explore Destinations
            </button>
          </div>
        </section>

          <section id="destinations" aria-label="Featured Destinations">
            <h2 className="section-title">Featured Destinations</h2>
            <div className="destinations">
              <article className="card" tabIndex="0">
                <img
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80"
                  alt="Maldives Beach"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80';
                  }}
                />
                <div className="card-body">
                  <h3>Maldives</h3>
                  <p>Experience crystal clear waters, white sandy beaches, and luxurious overwater bungalows.</p>
                  <button className="btn-secondary" aria-label="Learn more about Maldives">Learn More</button>
                </div>
              </article>

              <article className="card" tabIndex="0">
                <img
                  src="https://images.unsplash.com/photo-1549887535-1652218b7c31?auto=format&fit=crop&w=600&q=80"
                  alt="Santorini"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80';
                  }}
                />
                <div className="card-body">
                  <h3>Santorini, Greece</h3>
                  <p>Explore iconic whitewashed buildings and stunning sunsets over the Aegean Sea.</p>
                  <button className="btn-secondary" aria-label="Learn more about Santorini">Learn More</button>
                </div>
              </article>

              <article className="card" tabIndex="0">
                <img
                  src="https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=600&q=80"
                  alt="Kyoto"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80';
                  }}
                />
                <div className="card-body">
                  <h3>Kyoto, Japan</h3>
                  <p>Discover ancient temples, traditional tea ceremonies, and vibrant cherry blossoms.</p>
                  <button className="btn-secondary" aria-label="Learn more about Kyoto">Learn More</button>
                </div>
              </article>

              <article className="card" tabIndex="0">
                <img
                  src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=600&q=80"
                  alt="Grand Canyon"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80';
                  }}
                />
                <div className="card-body">
                  <h3>Grand Canyon</h3>
                  <p>Witness majestic landscapes carved over millions of years amidst the Southwest USA.</p>
                  <button className="btn-secondary" aria-label="Learn more about Grand Canyon">Learn More</button>
                </div>
              </article>
            </div>
          </section>

        <section id="tours" aria-label="Popular Tours">
          <h2 className="section-title">Popular Tours</h2>

          {toursLoading ? (
            <div style={{ textAlign: 'center', color: '#555' }}>Loading tours...</div>
          ) : toursError ? (
            <div style={{ textAlign: 'center', color: '#c0392b' }}>{toursError}</div>
          ) : popularTours.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555' }}>No tours available right now.</div>
          ) : (
            <div className="tours">
              {popularTours.map((tour, idx) => (
                <article className="tour" tabIndex="0" key={tour.product_id || tour.id || idx}>
                  <img
                    src={tour.image || tourImages[idx % tourImages.length]}
                    alt={tour.name || 'Tour'}
                  />
                  <div className="tour-content">
                    <h3>{tour.name || 'Tour'}</h3>
                    <p>{tour.description || 'Explore an unforgettable experience.'}</p>
                    <div className="price">${Number(tour.price || 0).toFixed(2)}</div>
                    <button
                      aria-label={`Book ${tour.name || 'tour'}`}
                      onClick={() => navigate(`/tours?search=${encodeURIComponent(tour.name || '')}`)}
                    >
                      Book Now
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => navigate('/tours')}
              aria-label="View all tours"
            >
              View All Tours
            </button>
          </div>
        </section>

          <section id="testimonials" aria-label="Testimonials from travelers">
            <h2 className="section-title">What Our Travelers Say</h2>
            <div className="testimonials">
              <div className="testimonial" tabIndex="0">
                <p>"ExploreWorld made our honeymoon unforgettable. The Maldives trip was flawless and breathtaking."</p>
                <div className="author">- Emily &amp; David</div>
              </div>

              <div className="testimonial" tabIndex="0">
                <p>"The African Safari tour was an adventure of a lifetime! Great guides and amazing organization."</p>
                <div className="author">- Rajesh K.</div>
              </div>

              <div className="testimonial" tabIndex="0">
                <p>"I loved the Santorini experience recommended by ExploreWorld. The sunsets truly are magical."</p>
                <div className="author">- Alice M.</div>
              </div>
            </div>
          </section>

          <footer aria-label="Contact information and social media links">
            <p>Contact us: info@exploreworld.com | +1 (555) 123-4567</p>
            <div className="social-icons" aria-label="Social media links">
              <a href="#" aria-label="Facebook">
                {/* Add your SVG here */}
              </a>
              <a href="#" aria-label="Twitter">
                {/* Add your SVG here */}
              </a>
              <a href="#" aria-label="Instagram">
                {/* Add your SVG here */}
              </a>
              <a href="#" aria-label="LinkedIn">
                {/* Add your SVG here */}
              </a>
            </div>
            <p>© 2024 ExploreWorld. All rights reserved.</p>
          </footer>
      </div>
    </>
  );
};

export default HomePage;
