'use strict';

/**
 * Summit Sage — Shared content datasets (dummy, easy to edit).
 * Testimonials, leaderboard, badges, blog posts, founders, gallery,
 * partners and press. Exposed on window.SS.*
 */
(function () {
  window.SS = window.SS || {};

  const U = function (id, w) {
    return (
      'https://images.unsplash.com/photo-' +
      id +
      '?auto=format&fit=crop&w=' +
      (w || 800) +
      '&q=70'
    );
  };

  window.SS.testimonials = [
    { name: 'Ananya Sen', trek: 'Sandakphu – Phalut', city: 'Kolkata', rating: 5, initials: 'AS',
      quote: 'My first-ever trek and Summit Sage made it magical. The guides were patient, the community warm, and that Sleeping Buddha sunrise… I still get goosebumps.' },
    { name: 'Rohan Gupta', trek: 'Kedarkantha', city: 'Howrah', rating: 5, initials: 'RG',
      quote: 'Flawless organisation from Kolkata to the summit and back. Live seat updates, WhatsApp reminders, gear guidance — it felt premium at every step.' },
    { name: 'Meghna Iyer', trek: 'Valley of Flowers', city: 'Salt Lake', rating: 5, initials: 'MI',
      quote: 'As a solo woman traveller I felt completely safe. The buddy finder matched me with the loveliest group. Already booked my next one!' },
    { name: 'Arjun Das', trek: 'Goecha La', city: 'Durgapur', rating: 5, initials: 'AD',
      quote: 'A genuinely tough expedition run by genuinely competent people. Oxygen, medical checks, everything by the book. Standing before Kanchenjunga was worth every step.' },
    { name: 'Priya Nair', trek: 'Brahmatal', city: 'Kolkata', rating: 4, initials: 'PN',
      quote: 'Loved the winter snow and the bonfire nights. The loyalty points got me a neat discount on my second trek. Small touches that matter.' },
    { name: 'Sourav Bose', trek: 'Roopkund', city: 'Barrackpore', rating: 5, initials: 'SB',
      quote: 'The bugyals are unreal. Summit Sage’s photographers even captured shots I now have framed at home. Best trekking community in East India, hands down.' },
  ];

  window.SS.leaderboard = [
    { name: 'Debjani Roy', treks: 27, points: 8450, tier: 'Summit', initials: 'DR' },
    { name: 'Kaushik Sen', treks: 23, points: 7200, tier: 'Summit', initials: 'KS' },
    { name: 'Ishita Mitra', treks: 19, points: 6100, tier: 'Gold', initials: 'IM' },
    { name: 'Farhan Ahmed', treks: 16, points: 5300, tier: 'Gold', initials: 'FA' },
    { name: 'Nikhil Rao', treks: 14, points: 4650, tier: 'Gold', initials: 'NR' },
    { name: 'Sneha Pal', treks: 11, points: 3800, tier: 'Silver', initials: 'SP' },
    { name: 'Aritra Ghosh', treks: 9, points: 3100, tier: 'Silver', initials: 'AG' },
    { name: 'Riya Kapoor', treks: 6, points: 2050, tier: 'Bronze', initials: 'RK' },
  ];

  window.SS.badges = [
    { icon: 'fa-mountain-sun', name: 'First Summit', unlocked: true },
    { icon: 'fa-snowflake', name: 'Snow Walker', unlocked: true },
    { icon: 'fa-fire', name: 'Bonfire Nights', unlocked: true },
    { icon: 'fa-people-group', name: 'Trek Buddy', unlocked: true },
    { icon: 'fa-camera-retro', name: 'Trail Lens', unlocked: true },
    { icon: 'fa-medal', name: '5 Treks Club', unlocked: true },
    { icon: 'fa-ranking-star', name: 'Leaderboard Top 50', unlocked: false },
    { icon: 'fa-mountain', name: '5000m Club', unlocked: false },
    { icon: 'fa-hands-holding-circle', name: 'Ambassador', unlocked: false },
    { icon: 'fa-crown', name: 'Summit Tier', unlocked: false },
  ];

  window.SS.blog = [
    { slug: 'beginners-guide', cat: 'Guides', title: 'The Complete Beginner’s Guide to Himalayan Trekking',
      excerpt: 'Everything a first-timer from Kolkata needs — fitness, gear, altitude and mindset — in one honest guide.',
      author: 'Rupak Debnath', date: 'Jun 2026', read: 9, image: U('1454496522488-7a8e488e8606'), lang: 'en' },
    { slug: 'monsoon-treks', cat: 'Stories', title: 'বর্ষায় ট্রেকিং: ভ্যালি অফ ফ্লাওয়ার্সের রূপকথা',
      excerpt: 'বর্ষার হিমালয়ে ফুলের উপত্যকা — এক ট্রেকারের চোখে দেখা রঙিন অভিজ্ঞতা এবং ব্যবহারিক পরামর্শ।',
      author: 'Soumik Mondal', date: 'Jun 2026', read: 7, image: U('1464822759023-fed622ff2c3b'), lang: 'bn' },
    { slug: 'layering-system', cat: 'Gear', title: 'Master the 3-Layer System for Sub-Zero Treks',
      excerpt: 'Base, mid and shell — how to stay warm on winter summits without carrying half your wardrobe.',
      author: 'Ananya Sen', date: 'May 2026', read: 6, image: U('1483728642387-6c3bdd6c93e5'), lang: 'en' },
    { slug: 'acclimatisation', cat: 'Guides', title: 'Altitude & Acclimatisation: Trek High, Sleep Low',
      excerpt: 'The science of AMS, and the simple rules that keep you safe above 3,000 metres.',
      author: 'Dr. Ipsita Roy', date: 'May 2026', read: 8, image: U('1486911278844-a81c5267e227'), lang: 'en' },
    { slug: 'sandakphu-diary', cat: 'Stories', title: 'A Sandakphu Diary: Four 8000ers Before Breakfast',
      excerpt: 'Five days on the Singalila ridge, told through a trekker’s field notes and photographs.',
      author: 'Rohan Gupta', date: 'Apr 2026', read: 10, image: U('1626621341517-bbf3d9990a23'), lang: 'en' },
    { slug: 'backpack-checklist', cat: 'Gear', title: 'The 45-Litre Packing Checklist (Free PDF)',
      excerpt: 'Our field-tested packing list, refined over 200+ treks, that fits into a single 45L pack.',
      author: 'Team Summit Sage', date: 'Apr 2026', read: 5, image: U('1501554728187-ce583db33af7'), lang: 'en' },
  ];

  window.SS.founders = [
    { name: 'Soumik Mondal', role: 'Co-founder & Expedition Lead', initials: 'SM',
      bio: 'Certified mountaineer with 60+ Himalayan expeditions. Soumik designs every route and leads our toughest summits.',
      image: U('1500648767791-00dcc994a43e') },
    { name: 'Rupak Debnath', role: 'Co-founder & Community Head', initials: 'RD',
      bio: 'Builder of the Summit Sage community. Rupak looks after trekker experience, ambassadors and partnerships.',
      image: U('1507003211169-0a1dd7228f2d') },
    { name: 'Ishita Mitra', role: 'Co-founder & Safety Director', initials: 'IM',
      bio: 'Wilderness first-responder and logistics expert. Ishita owns safety protocols, medical readiness and guide training.',
      image: U('1544005313-94ddf0286df2') },
  ];

  window.SS.gallery = [
    { img: U('1516571748831-5d81767b788d', 900), trek: 'Kedarkantha', span: 'tall' },
    { img: U('1454496522488-7a8e488e8606', 900), trek: 'Roopkund' },
    { img: U('1464822759023-fed622ff2c3b', 900), trek: 'Valley of Flowers', span: 'wide' },
    { img: U('1626621341517-bbf3d9990a23', 900), trek: 'Sandakphu' },
    { img: U('1486911278844-a81c5267e227', 900), trek: 'Goecha La', span: 'tall' },
    { img: U('1483728642387-6c3bdd6c93e5', 900), trek: 'Brahmatal' },
    { img: U('1506905925346-21bda4d32df4', 900), trek: 'Har Ki Dun' },
    { img: U('1441974231531-c6227db76b6e', 900), trek: 'Ajodhya Hills', span: 'wide' },
    { img: U('1548134600-af0dd7f43de5', 900), trek: 'Chadar' },
    { img: U('1454496406107-dc34337da8d6', 900), trek: 'Base Camp' },
  ];

  window.SS.partners = ['Decathlon', 'Wildcraft', 'Quechua', 'GoPro', 'Red Bull', 'Tata Salt'];

  window.SS.press = ['The Telegraph', 'Times of India', 'ABP Ananda', 'YourStory', 'Outlook Traveller'];

  window.SS.instagram = [
    U('1516571748831-5d81767b788d', 400), U('1454496522488-7a8e488e8606', 400),
    U('1464822759023-fed622ff2c3b', 400), U('1626621341517-bbf3d9990a23', 400),
    U('1486911278844-a81c5267e227', 400), U('1483728642387-6c3bdd6c93e5', 400),
    U('1506905925346-21bda4d32df4', 400), U('1441974231531-c6227db76b6e', 400),
    U('1548134600-af0dd7f43de5', 400), U('1454496406107-dc34337da8d6', 400),
    U('1500648767791-00dcc994a43e', 400), U('1501554728187-ce583db33af7', 400),
  ];
})();
