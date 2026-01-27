import React from 'react';
import '../../assets/styles/About.scss';

const About = () => {
  return (
    <div className="about-page">
      <section className="about-hero" aria-label="About TourismHub">
        <div className="about-hero__content">
          <h1>About TourismHub</h1>
          <p>
            We help travelers discover tours they’ll love—then book confidently with clear schedules,
            transparent pricing, and secure payments.
          </p>
        </div>
      </section>

      <section className="about-section" aria-label="What we offer">
        <h2 className="about-section__title">What we offer</h2>
        <div className="about-grid">
          <div className="about-card">
            <h3>Curated tours</h3>
            <p>High-quality experiences across categories and destinations, organized for easy browsing.</p>
          </div>
          <div className="about-card">
            <h3>Real schedules</h3>
            <p>Choose from available travel dates and remaining capacity—no guessing, no surprises.</p>
          </div>
          <div className="about-card">
            <h3>Secure checkout</h3>
            <p>Pay safely through MoMo and confirm instantly once the gateway verifies the transaction.</p>
          </div>
        </div>
      </section>

      <section className="about-section" aria-label="Our mission">
        <div className="about-split">
          <div className="about-split__left">
            <h2 className="about-section__title">Our mission</h2>
            <p className="about-section__text">
              Make travel planning simple and trustworthy—from discovery to payment to confirmed booking.
              We focus on clarity, reliability, and a great user experience for both guests and registered users.
            </p>
          </div>
          <div className="about-split__right">
            <div className="about-highlight">
              <div className="about-highlight__label">Core values</div>
              <ul className="about-highlight__list">
                <li><strong>Transparency</strong>: clear prices, dates, and policies.</li>
                <li><strong>Reliability</strong>: consistent booking & payment status updates.</li>
                <li><strong>Security</strong>: authenticated admin analytics and protected user bookings.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section" aria-label="Contact">
        <div className="about-footer">
          <h2 className="about-section__title">Want to work with us?</h2>
          <p className="about-section__text">
            For partnerships or support, contact <strong>support@tourismhub.com</strong>.
          </p>
        </div>
      </section>
    </div>
  );
};

export default About;


