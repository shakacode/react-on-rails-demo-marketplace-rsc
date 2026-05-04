# frozen_string_literal: true

class SearchProductSeeder
  ADDITIONAL_PRODUCTS = [
    # === Speakers ===
    {
      name: 'SoundWave Horizon 360 Smart Speaker',
      description: <<~MD,
        ## Immersive Room-Filling Sound

        The SoundWave Horizon 360 delivers **true 360-degree audio** with its proprietary cylindrical driver array. Six full-range drivers and two passive radiators work in harmony to fill any room with rich, detailed sound from every angle.

        ### Smart Home Integration

        Built-in voice assistant compatibility with **Alexa, Google Assistant, and Siri** makes the Horizon 360 the centerpiece of your smart home. Control your music, manage your schedule, and control connected devices — all hands-free.

        ### Features

        - **360° omnidirectional sound** with room calibration
        - **Wi-Fi 6 and Bluetooth 5.3** dual connectivity
        - **Multi-room sync** — pair up to 8 speakers
        - **USB-C and AUX input** for wired sources
        - **Touch-sensitive top panel** with LED ring indicator

        ### Audio Specs

        ```
        Drivers:       6 × 2.5" full-range + 2 × 4" passive radiators
        Frequency:     35Hz - 20kHz
        Power:         120W RMS
        THD:           < 0.5%
        ```
      MD
      price: 249.99,
      original_price: 299.99,
      category: 'Speakers',
      brand: 'SoundWave',
      sku: 'SW-H360-BLK',
      images: [
        { url: '/seed-images/products/prod-9580ab89b40b.jpg', alt: 'SoundWave Horizon 360 Speaker', position: 0 },
        { url: '/seed-images/products/prod-b33ccf30ed38.jpg', alt: 'SoundWave Horizon 360 - Room setup', position: 1 }
      ],
      specs: { 'Type' => 'Smart Speaker', 'Drivers' => '6 × 2.5" + 2 × 4" passive', 'Power' => '120W RMS', 'Connectivity' => 'Wi-Fi 6 / Bluetooth 5.3', 'Voice Assistant' => 'Alexa, Google, Siri', 'Weight' => '2.8 kg' },
      features: ['360-degree omnidirectional sound', 'Multi-room synchronization up to 8 speakers', 'Voice assistant with Alexa, Google & Siri', 'Adaptive room calibration technology', 'Touch-sensitive controls with LED ring'],
      tags: ['wireless', 'smart-home', 'bluetooth', 'wifi', 'voice-assistant', 'multi-room'],
      average_rating: 4.5,
      stock_quantity: 156
    },
    {
      name: 'AudioTech Rumble Portable Bluetooth Speaker',
      description: "Rugged portable speaker with IP68 water/dust resistance and 24-hour battery life. Perfect for outdoor adventures with powerful bass.\n\n### Key Features\n- IP68 rating for underwater use\n- 24-hour battery\n- True Wireless Stereo pairing\n- Built-in power bank",
      price: 89.99,
      original_price: 119.99,
      category: 'Speakers',
      brand: 'AudioTech',
      sku: 'AT-RMBL-BLU',
      images: [{ url: '/seed-images/products/prod-bc0118fa6e4c.jpg', alt: 'AudioTech Rumble Speaker', position: 0 }],
      specs: { 'Type' => 'Portable Bluetooth', 'Battery' => '24 hours', 'Water Resistance' => 'IP68', 'Power' => '30W', 'Weight' => '680g' },
      features: ['IP68 water and dust resistance', '24-hour battery life', 'True Wireless Stereo pairing', 'Built-in 5000mAh power bank'],
      tags: ['portable', 'waterproof', 'outdoor', 'bluetooth', 'rugged'],
      average_rating: 4.3,
      stock_quantity: 289
    },
    {
      name: 'ProSound SoundBar Cinema 5.1',
      description: "Premium 5.1 channel soundbar system with wireless subwoofer and rear speakers. Dolby Atmos and DTS:X support for true cinematic audio at home.\n\n### Specifications\n- 5.1.2 channel Dolby Atmos\n- Wireless subwoofer with 8\" driver\n- HDMI eARC passthrough\n- 4K HDR10+ compatible",
      price: 599.99,
      original_price: 749.99,
      category: 'Speakers',
      brand: 'ProSound',
      sku: 'PS-SBC51-BLK',
      images: [{ url: '/seed-images/products/prod-52359cc7abd1.jpg', alt: 'ProSound SoundBar Cinema', position: 0 }],
      specs: { 'Type' => '5.1 Soundbar System', 'Channels' => '5.1.2', 'Total Power' => '550W', 'Subwoofer' => 'Wireless 8" driver', 'HDMI' => 'eARC / 3 inputs', 'Dolby Atmos' => 'Yes' },
      features: ['5.1.2 Dolby Atmos surround sound', 'Wireless subwoofer and rear speakers', 'HDMI eARC with 4K HDR10+ passthrough', 'Adaptive sound modes for movies, music, gaming'],
      tags: ['home-theater', 'dolby-atmos', 'surround-sound', 'soundbar', 'wireless-subwoofer'],
      average_rating: 4.6,
      stock_quantity: 73
    },

    # === Smartwatches ===
    {
      name: 'TechFit Ultra GPS Smartwatch',
      description: <<~MD,
        ## The Ultimate Fitness Companion

        The TechFit Ultra combines **advanced health monitoring** with rugged outdoor capabilities. Featuring a stunning 1.4" AMOLED always-on display protected by sapphire crystal glass, this smartwatch is built for both the boardroom and the backcountry.

        ### Health & Fitness

        - **Continuous heart rate** with irregular rhythm detection
        - **Blood oxygen (SpO2)** monitoring with altitude acclimatization
        - **Sleep tracking** with sleep stages and sleep score
        - **100+ workout modes** including running, cycling, swimming, hiking
        - **GPS + GLONASS + Galileo** triple-satellite positioning

        ### Smart Features

        Built-in **NFC for contactless payments**, music storage for 500+ songs, and smart notifications. The always-on display shows your watch face even in direct sunlight.

        ### Battery Life

        - **14 days** typical use
        - **36 hours** continuous GPS tracking
        - **Quick charge**: 10 minutes = 1 day of use
      MD
      price: 349.99,
      original_price: 399.99,
      category: 'Smartwatches',
      brand: 'TechFit',
      sku: 'TF-ULTRA-TT',
      images: [
        { url: '/seed-images/products/prod-e52f31db7059.jpg', alt: 'TechFit Ultra Smartwatch', position: 0 },
        { url: '/seed-images/products/prod-4b6ef77c9517.jpg', alt: 'TechFit Ultra - Sport mode', position: 1 }
      ],
      specs: { 'Display' => '1.4" AMOLED 454×454', 'Battery' => '14 days typical', 'GPS' => 'GPS/GLONASS/Galileo', 'Water Resistance' => '10 ATM', 'Storage' => '32GB', 'Sensors' => 'HR, SpO2, Barometer, Compass, Gyro', 'NFC' => 'Yes (payments)', 'Weight' => '52g' },
      features: ['14-day battery with GPS', 'Sapphire crystal AMOLED display', 'Triple-satellite GPS positioning', 'Blood oxygen and heart rate monitoring', '100+ workout modes with auto-detection', 'NFC contactless payments'],
      tags: ['fitness', 'gps', 'health-monitoring', 'waterproof', 'nfc', 'amoled'],
      average_rating: 4.4,
      stock_quantity: 198
    },
    {
      name: 'TechFit Lite Band',
      description: "Slim fitness tracker with heart rate, sleep tracking, and 7-day battery life. Water-resistant to 50 meters.\n\nPerfect entry-level fitness band with all the essentials at an affordable price.",
      price: 49.99,
      original_price: 69.99,
      category: 'Smartwatches',
      brand: 'TechFit',
      sku: 'TF-LITE-BLK',
      images: [{ url: '/seed-images/products/prod-5632f16fe718.jpg', alt: 'TechFit Lite Band', position: 0 }],
      specs: { 'Display' => '0.96" OLED', 'Battery' => '7 days', 'Water Resistance' => '5 ATM', 'Weight' => '23g' },
      features: ['7-day battery life', 'Heart rate monitoring', 'Sleep tracking with stages', 'Water-resistant to 50m'],
      tags: ['fitness', 'budget', 'lightweight', 'waterproof', 'heart-rate'],
      average_rating: 4.1,
      stock_quantity: 542
    },
    {
      name: 'NovaBeat SmartWatch Pro',
      description: "Feature-rich smartwatch with cellular connectivity, allowing calls and texts without your phone. Rotating crown for intuitive navigation.\n\n### Connectivity\n- 4G LTE cellular\n- Wi-Fi and Bluetooth 5.2\n- GPS with real-time tracking",
      price: 449.99,
      original_price: nil,
      category: 'Smartwatches',
      brand: 'NovaBeat',
      sku: 'NB-SWP-SLV',
      images: [{ url: '/seed-images/products/prod-d6138c06d30a.jpg', alt: 'NovaBeat SmartWatch Pro', position: 0 }],
      specs: { 'Display' => '1.5" AMOLED', 'Cellular' => '4G LTE', 'Battery' => '3 days', 'Storage' => '32GB', 'OS' => 'WearOS 5', 'Weight' => '45g' },
      features: ['4G LTE cellular connectivity', 'Rotating digital crown', 'Always-on AMOLED display', 'Google Pay and Samsung Pay support'],
      tags: ['cellular', 'premium', 'amoled', 'nfc', 'gps'],
      average_rating: 4.2,
      stock_quantity: 134
    },

    # === Cameras ===
    {
      name: 'PixelPro X100 Mirrorless Camera',
      description: <<~MD,
        ## Professional Mirrorless Photography

        The PixelPro X100 is a **full-frame mirrorless camera** that delivers exceptional image quality with its 45.7MP BSI CMOS sensor. Whether you're shooting landscapes, portraits, or fast-action sports, the X100 delivers stunning results.

        ### Image Quality

        - **45.7 megapixel** back-illuminated CMOS sensor
        - **ISO 64–25,600** (expandable to 32–102,400)
        - **14-bit RAW** with lossless compression
        - **EXPEED 7 processor** for rapid shot-to-shot performance

        ### Autofocus System

        The X100 features a **493-point hybrid AF** system covering 90% of the frame. Subject detection AI recognizes people, animals, vehicles, and aircraft for effortless tracking.

        ### Video Capabilities

        - **8K 30fps** and **4K 120fps** internal recording
        - **N-Log and HLG** HDR profiles
        - **10-bit 4:2:2** internal recording
        - ProRes RAW output via HDMI

        ### Build Quality

        Weather-sealed magnesium alloy body with **dust and moisture resistance**. Carbon fiber composite top and base plates for weight reduction without compromising durability.
      MD
      price: 2499.99,
      original_price: 2799.99,
      category: 'Cameras',
      brand: 'PixelPro',
      sku: 'PP-X100-BDY',
      images: [
        { url: '/seed-images/products/prod-899d6810bda2.jpg', alt: 'PixelPro X100 Mirrorless Camera', position: 0 },
        { url: '/seed-images/products/prod-0f1e29b1e979.jpg', alt: 'PixelPro X100 - Top view', position: 1 },
        { url: '/seed-images/products/prod-82004394f2db.jpg', alt: 'PixelPro X100 - In use', position: 2 }
      ],
      specs: { 'Sensor' => '45.7MP Full-Frame BSI CMOS', 'Processor' => 'EXPEED 7', 'ISO Range' => '64–25,600 (exp. 32–102,400)', 'AF Points' => '493 hybrid', 'Video' => '8K30 / 4K120', 'EVF' => '3.69M-dot OLED', 'Body' => 'Magnesium alloy, weather-sealed', 'Weight' => '680g (body only)', 'Card Slots' => 'Dual CFexpress Type B', 'Battery' => '~400 shots per charge' },
      features: ['45.7MP full-frame BSI CMOS sensor', '8K30 and 4K120 internal video recording', '493-point hybrid autofocus with AI subject detection', 'Weather-sealed magnesium alloy body', 'Dual CFexpress Type B card slots', '3.69M-dot OLED electronic viewfinder'],
      tags: ['mirrorless', 'full-frame', '8k-video', 'professional', 'weather-sealed'],
      average_rating: 4.7,
      stock_quantity: 42
    },
    {
      name: 'PixelPro ActionCam 5K',
      description: "Ultra-compact 5K action camera with horizon leveling, waterproof to 33ft without housing, and advanced stabilization.\n\n### Highlights\n- 5K 30fps / 4K 60fps recording\n- HyperSmooth 5.0 stabilization\n- Waterproof to 33ft (10m)\n- Voice control with 16 commands",
      price: 349.99,
      original_price: 399.99,
      category: 'Cameras',
      brand: 'PixelPro',
      sku: 'PP-AC5K',
      images: [{ url: '/seed-images/products/prod-1b4f0901bfbb.jpg', alt: 'PixelPro ActionCam 5K', position: 0 }],
      specs: { 'Sensor' => '1/1.9" CMOS', 'Video' => '5K30 / 4K60', 'Stabilization' => 'HyperSmooth 5.0', 'Waterproof' => '10m without housing', 'Battery' => '95 minutes', 'Weight' => '153g' },
      features: ['5K 30fps video recording', 'HyperSmooth 5.0 stabilization', 'Waterproof to 10m without housing', 'Horizon leveling up to 45°'],
      tags: ['action-camera', 'waterproof', '5k-video', 'stabilization', 'outdoor'],
      average_rating: 4.4,
      stock_quantity: 215
    },
    {
      name: 'LensMaster 24-70mm f/2.8 Pro Zoom',
      description: "Professional constant-aperture zoom lens with nano crystal coating for minimal flare and ghosting. Sharp corner-to-corner at all focal lengths.\n\n### Optical Design\n- 17 elements in 15 groups\n- Nano crystal coat + ARNEO coat\n- 9 rounded diaphragm blades",
      price: 1899.99,
      original_price: nil,
      category: 'Cameras',
      brand: 'LensMaster',
      sku: 'LM-2470-F28',
      images: [{ url: '/seed-images/products/prod-0fc9b8e755d0.jpg', alt: 'LensMaster 24-70mm Lens', position: 0 }],
      specs: { 'Focal Length' => '24-70mm', 'Aperture' => 'f/2.8 constant', 'Mount' => 'Z-mount (FX)', 'Elements' => '17 in 15 groups', 'Filter Size' => '82mm', 'Weight' => '805g', 'Min Focus' => '0.38m' },
      features: ['f/2.8 constant aperture', 'Nano crystal and ARNEO coatings', 'Weather-sealed construction', 'Silent stepping motor AF'],
      tags: ['lens', 'zoom', 'professional', 'weather-sealed', 'full-frame'],
      average_rating: 4.8,
      stock_quantity: 67
    },

    # === Laptops ===
    {
      name: 'TechNova UltraBook Pro 16',
      description: <<~MD,
        ## Power Meets Portability

        The TechNova UltraBook Pro 16 delivers **desktop-class performance** in an impossibly thin and light design. Powered by the latest M-series chip with 12-core CPU and 18-core GPU, it handles everything from video editing to 3D rendering with ease.

        ### Display

        The stunning **16.2" Liquid Retina XDR display** with 3456×2234 resolution delivers:
        - **1,600 nits peak brightness** for HDR content
        - **ProMotion 120Hz** adaptive refresh rate
        - **P3 wide color gamut** with True Tone
        - **Anti-reflective coating** for outdoor use

        ### Performance

        - 12-core CPU (8 performance + 4 efficiency)
        - 18-core GPU with hardware ray tracing
        - 36GB unified memory
        - 1TB ultra-fast SSD (7.4GB/s read)

        ### All-Day Battery

        Up to **22 hours** of video playback. MagSafe fast charging restores 50% in just 30 minutes.
      MD
      price: 2399.99,
      original_price: nil,
      category: 'Laptops',
      brand: 'TechNova',
      sku: 'TN-UBP16-SLV',
      images: [
        { url: '/seed-images/products/prod-a1b2394384c5.jpg', alt: 'TechNova UltraBook Pro 16', position: 0 },
        { url: '/seed-images/products/prod-6aaa382e507d.jpg', alt: 'TechNova UltraBook Pro 16 - Open', position: 1 }
      ],
      specs: { 'CPU' => '12-core (8P + 4E)', 'GPU' => '18-core with RT', 'RAM' => '36GB unified', 'Storage' => '1TB SSD', 'Display' => '16.2" Retina XDR 3456×2234', 'Refresh Rate' => '120Hz ProMotion', 'Battery' => '22 hours video', 'Weight' => '2.14 kg', 'Ports' => 'HDMI, 3× USB-C, SD card, MagSafe' },
      features: ['16.2" Liquid Retina XDR display with ProMotion', '12-core CPU for desktop-class performance', '22-hour battery life with MagSafe charging', 'Hardware ray tracing GPU', 'Advanced camera with Center Stage'],
      tags: ['laptop', 'professional', 'retina', 'high-performance', 'creative'],
      average_rating: 4.6,
      stock_quantity: 89
    },
    {
      name: 'TechNova AirSlim 13',
      description: "Ultralight 13.6\" laptop weighing just 1.24 kg with fanless design and all-day battery. Perfect for students and mobile professionals.\n\n### Highlights\n- 15-hour battery life\n- Fanless silent operation\n- Backlit Magic Keyboard\n- 1080p FaceTime camera",
      price: 999.99,
      original_price: 1099.99,
      category: 'Laptops',
      brand: 'TechNova',
      sku: 'TN-AS13-MNG',
      images: [{ url: '/seed-images/products/prod-af987db2fc1e.jpg', alt: 'TechNova AirSlim 13', position: 0 }],
      specs: { 'CPU' => '8-core', 'GPU' => '10-core', 'RAM' => '16GB', 'Storage' => '512GB SSD', 'Display' => '13.6" Retina 2560×1664', 'Battery' => '15 hours', 'Weight' => '1.24 kg' },
      features: ['Fanless silent design', '15-hour battery life', 'Retina display with True Tone', 'MagSafe charging'],
      tags: ['ultralight', 'laptop', 'portable', 'silent', 'student'],
      average_rating: 4.5,
      stock_quantity: 234
    },
    {
      name: 'GameForce Titan 17 Gaming Laptop',
      description: "High-performance gaming laptop with RTX 4080 GPU, 240Hz display, and per-key RGB mechanical keyboard. Built for competitive gaming.\n\n### Performance\n- Intel i9-14900HX processor\n- NVIDIA RTX 4080 12GB\n- 32GB DDR5-5600\n- 1TB PCIe Gen5 NVMe\n\n### Display\n- 17.3\" QHD 240Hz\n- 3ms response time\n- G-Sync compatible\n- 100% DCI-P3",
      price: 2799.99,
      original_price: 3199.99,
      category: 'Laptops',
      brand: 'GameForce',
      sku: 'GF-TITAN17',
      images: [{ url: '/seed-images/products/prod-11c6ba1314d2.jpg', alt: 'GameForce Titan 17', position: 0 }],
      specs: { 'CPU' => 'Intel i9-14900HX', 'GPU' => 'RTX 4080 12GB', 'RAM' => '32GB DDR5-5600', 'Storage' => '1TB PCIe Gen5', 'Display' => '17.3" QHD 240Hz', 'Battery' => '4.5 hours', 'Weight' => '2.75 kg' },
      features: ['NVIDIA RTX 4080 12GB GPU', '240Hz QHD display with G-Sync', 'Per-key RGB mechanical keyboard', 'Advanced vapor chamber cooling'],
      tags: ['gaming', 'high-performance', 'rtx', 'mechanical-keyboard', '240hz'],
      average_rating: 4.3,
      stock_quantity: 56
    },

    # === Tablets ===
    {
      name: 'TechNova Pad Pro 12.9',
      description: <<~MD,
        ## Create Without Limits

        The TechNova Pad Pro 12.9 features a revolutionary **tandem OLED display** delivering unprecedented brightness and contrast. Combined with the M4 chip, it's the most powerful creative tablet ever made.

        ### Display Technology

        Ultra Bright XDR tandem OLED:
        - **1,000 nits full-screen / 1,600 nits HDR peak**
        - **120Hz ProMotion** with Apple Pencil hover
        - **Nano-texture glass** option for reduced glare
        - Sub-millisecond pixel response time

        ### Creative Power

        - M4 chip with 10-core CPU
        - Hardware-accelerated ray tracing
        - Thunderbolt / USB 4 port
        - Support for external 6K display
      MD
      price: 1299.99,
      original_price: nil,
      category: 'Tablets',
      brand: 'TechNova',
      sku: 'TN-PP129-SG',
      images: [
        { url: '/seed-images/products/prod-3cebb75c7941.jpg', alt: 'TechNova Pad Pro 12.9', position: 0 },
        { url: '/seed-images/products/prod-b4a437825524.jpg', alt: 'TechNova Pad Pro - Drawing', position: 1 }
      ],
      specs: { 'Display' => '12.9" XDR OLED 2732×2048', 'Chip' => 'M4 10-core', 'RAM' => '16GB', 'Storage' => '256GB', 'Battery' => '10 hours', 'Weight' => '682g', 'Connectivity' => 'Wi-Fi 6E, Bluetooth 5.3, 5G optional' },
      features: ['Tandem OLED XDR display', 'M4 chip with 10-core CPU', 'Apple Pencil Pro hover detection', 'Thunderbolt / USB 4 connectivity', 'Face ID with secure authentication'],
      tags: ['tablet', 'creative', 'oled', 'professional', 'stylus-support'],
      average_rating: 4.7,
      stock_quantity: 167
    },
    {
      name: 'TechNova Pad Mini 8.3',
      description: "Compact yet powerful 8.3\" tablet perfect for reading, note-taking, and on-the-go productivity. Features A15 chip and all-screen design.\n\n- 8.3\" Liquid Retina display\n- A15 Bionic chip\n- USB-C connectivity\n- Apple Pencil 2 support",
      price: 499.99,
      original_price: 549.99,
      category: 'Tablets',
      brand: 'TechNova',
      sku: 'TN-PM83-PR',
      images: [{ url: '/seed-images/products/prod-729183604a5c.jpg', alt: 'TechNova Pad Mini', position: 0 }],
      specs: { 'Display' => '8.3" Liquid Retina', 'Chip' => 'A15 Bionic', 'Storage' => '128GB', 'Battery' => '10 hours', 'Weight' => '293g' },
      features: ['8.3" all-screen Liquid Retina display', 'A15 Bionic chip', 'USB-C with fast charging', 'Apple Pencil 2 support'],
      tags: ['tablet', 'compact', 'portable', 'reading', 'note-taking'],
      average_rating: 4.4,
      stock_quantity: 312
    },

    # === Microphones ===
    {
      name: 'VocalMaster Condenser USB Microphone',
      description: <<~MD,
        ## Studio-Quality Sound, Plug & Play

        The VocalMaster Condenser delivers **broadcast-grade audio** with zero setup. Just plug in the USB-C cable and start recording. Perfect for podcasting, streaming, voiceovers, and music production.

        ### Audio Quality
        - **24-bit/192kHz** recording resolution
        - **20Hz–20kHz** frequency response
        - **-36dB** sensitivity for detailed capture
        - Built-in **pop filter** and shock mount

        ### Four Polar Patterns
        Switch between cardioid, omnidirectional, bidirectional, and stereo patterns to adapt to any recording scenario.

        ### Real-time Monitoring
        Zero-latency 3.5mm headphone jack with independent gain and monitoring mix controls.
      MD
      price: 169.99,
      original_price: 199.99,
      category: 'Microphones',
      brand: 'VocalMaster',
      sku: 'VM-COND-USB',
      images: [
        { url: '/seed-images/products/prod-a2e631e64114.jpg', alt: 'VocalMaster Condenser Microphone', position: 0 },
        { url: '/seed-images/products/prod-0389fbb49b03.jpg', alt: 'VocalMaster - Recording setup', position: 1 }
      ],
      specs: { 'Type' => 'USB Condenser', 'Bit Depth' => '24-bit/192kHz', 'Frequency Response' => '20Hz–20kHz', 'Polar Patterns' => '4 (Cardioid, Omni, Bi, Stereo)', 'Connector' => 'USB-C', 'Headphone Output' => '3.5mm zero-latency', 'Weight' => '550g' },
      features: ['24-bit/192kHz studio-grade recording', 'Four selectable polar patterns', 'Zero-latency headphone monitoring', 'Built-in pop filter and shock mount', 'Plug & play USB-C — no drivers needed'],
      tags: ['podcast', 'streaming', 'usb', 'studio', 'recording', 'plug-and-play'],
      average_rating: 4.5,
      stock_quantity: 203
    },
    {
      name: 'VocalMaster Lavalier Pro Wireless',
      description: "Professional wireless lavalier microphone system with 200m range, 8-hour battery, and broadcast-quality audio. Ideal for interviews, presentations, and video production.",
      price: 249.99,
      original_price: nil,
      category: 'Microphones',
      brand: 'VocalMaster',
      sku: 'VM-LAV-WL',
      images: [{ url: '/seed-images/products/prod-f66b5b6c8d38.jpg', alt: 'VocalMaster Lavalier Pro', position: 0 }],
      specs: { 'Type' => 'Wireless Lavalier', 'Range' => '200m line-of-sight', 'Battery' => '8 hours', 'Frequency' => '2.4GHz digital', 'Latency' => '<4ms', 'Weight' => '30g (transmitter)' },
      features: ['200m wireless range', '8-hour battery life', '<4ms ultra-low latency', 'Dual-channel receiver for two mics'],
      tags: ['wireless', 'lavalier', 'professional', 'interview', 'video-production'],
      average_rating: 4.3,
      stock_quantity: 145
    },

    # === Storage ===
    {
      name: 'DataVault Thunderbolt 4 Portable SSD 2TB',
      description: <<~MD,
        ## Blazing Fast External Storage

        The DataVault Thunderbolt 4 SSD delivers **read speeds up to 3,000 MB/s** — fast enough to edit 8K video directly from the drive. The aluminum unibody design acts as a heat sink for sustained performance without throttling.

        ### Performance
        - **Sequential read:** 3,000 MB/s
        - **Sequential write:** 2,800 MB/s
        - **Random 4K IOPS:** 600K read / 500K write
        - Thunderbolt 4 / USB4 / USB 3.2 backward compatible

        ### Durability
        - IP67 water and dust resistance
        - MIL-STD-810H shock and vibration tested
        - AES 256-bit hardware encryption
        - 5-year warranty
      MD
      price: 299.99,
      original_price: 349.99,
      category: 'Storage',
      brand: 'DataVault',
      sku: 'DV-TB4-2TB',
      images: [{ url: '/seed-images/products/prod-2fc964503d75.jpg', alt: 'DataVault Thunderbolt SSD', position: 0 }],
      specs: { 'Capacity' => '2TB', 'Interface' => 'Thunderbolt 4 / USB4', 'Read Speed' => '3,000 MB/s', 'Write Speed' => '2,800 MB/s', 'Encryption' => 'AES 256-bit hardware', 'Durability' => 'IP67 / MIL-STD-810H', 'Weight' => '90g' },
      features: ['3,000 MB/s read speeds via Thunderbolt 4', 'IP67 and MIL-STD-810H durability', 'AES 256-bit hardware encryption', 'Backward compatible with USB 3.2'],
      tags: ['ssd', 'thunderbolt', 'portable', 'fast', 'encrypted', 'rugged'],
      average_rating: 4.6,
      stock_quantity: 178
    },
    {
      name: 'DataVault MicroSD Extreme 512GB',
      description: "High-speed microSD card with A2 app performance class. Perfect for drones, action cameras, and smartphones. 190 MB/s read, 130 MB/s write.",
      price: 59.99,
      original_price: 79.99,
      category: 'Storage',
      brand: 'DataVault',
      sku: 'DV-MSD-512',
      images: [{ url: '/seed-images/products/prod-566b43c72708.jpg', alt: 'DataVault MicroSD', position: 0 }],
      specs: { 'Capacity' => '512GB', 'Read Speed' => '190 MB/s', 'Write Speed' => '130 MB/s', 'Class' => 'A2, V30, U3', 'Type' => 'microSDXC' },
      features: ['190 MB/s read speed', 'A2 app performance class', 'V30 video speed class', '4K UHD video recording'],
      tags: ['memory-card', 'microsd', 'fast', 'drone', 'action-camera'],
      average_rating: 4.5,
      stock_quantity: 892
    },

    # === Keyboards ===
    {
      name: 'TypeMaster Mechanical Pro 75%',
      description: <<~MD,
        ## The Perfect Typing Experience

        The TypeMaster Mechanical Pro features **hot-swappable switches**, PBT double-shot keycaps, and a premium aluminum frame. The 75% layout preserves arrow keys and function row while minimizing desk footprint.

        ### Build Quality
        - **CNC aluminum** top case and base
        - **PBT double-shot** keycaps (won't fade or shine)
        - Gasket-mounted plate for typing comfort
        - Sound-dampening foam layers

        ### Connectivity
        - USB-C wired
        - Bluetooth 5.2 (3 devices)
        - 2.4GHz wireless dongle
        - 4,000mAh battery — up to 200 hours wireless

        ### Customization
        - Hot-swappable switches (3-pin and 5-pin)
        - Per-key RGB with 20+ effects
        - VIA/QMK firmware for full remapping
      MD
      price: 179.99,
      original_price: nil,
      category: 'Keyboards',
      brand: 'TypeMaster',
      sku: 'TM-MECH75',
      images: [
        { url: '/seed-images/products/prod-c806dbd081be.jpg', alt: 'TypeMaster Mechanical Pro 75%', position: 0 },
        { url: '/seed-images/products/prod-74a611a49b7e.jpg', alt: 'TypeMaster - RGB lighting', position: 1 }
      ],
      specs: { 'Layout' => '75% (84 keys)', 'Switches' => 'Hot-swappable (Gateron Pro)', 'Keycaps' => 'PBT Double-shot', 'Frame' => 'CNC Aluminum', 'Connectivity' => 'USB-C / BT 5.2 / 2.4GHz', 'Battery' => '4,000mAh (200 hrs)', 'Weight' => '1.1 kg', 'RGB' => 'Per-key with 20+ effects' },
      features: ['Hot-swappable mechanical switches', 'PBT double-shot keycaps', 'Triple connectivity: USB-C, Bluetooth, 2.4GHz', 'CNC aluminum construction', 'VIA/QMK programmable', 'Gasket-mounted for typing comfort'],
      tags: ['mechanical', 'hot-swap', 'rgb', 'wireless', 'aluminum', 'programmable'],
      average_rating: 4.6,
      stock_quantity: 143
    },
    {
      name: 'TypeMaster Ergonomic Split Keyboard',
      description: "Split ergonomic keyboard with adjustable tenting, wrist rests, and programmable thumb clusters. Designed to reduce strain during long typing sessions.",
      price: 299.99,
      original_price: 349.99,
      category: 'Keyboards',
      brand: 'TypeMaster',
      sku: 'TM-ERGO-SPL',
      images: [{ url: '/seed-images/products/prod-8a940301bb48.jpg', alt: 'TypeMaster Ergonomic Split', position: 0 }],
      specs: { 'Layout' => 'Split ergonomic', 'Switches' => 'Cherry MX Brown', 'Tenting' => '0-15° adjustable', 'Connectivity' => 'USB-C', 'Palm Rests' => 'Integrated magnetic' },
      features: ['Adjustable split angle and tenting', 'Integrated magnetic palm rests', 'Programmable thumb clusters', 'Cherry MX Brown switches'],
      tags: ['ergonomic', 'split', 'mechanical', 'wrist-rest', 'health'],
      average_rating: 4.4,
      stock_quantity: 87
    },

    # === Monitors ===
    {
      name: 'ViewPro UltraWide 34" Curved Monitor',
      description: <<~MD,
        ## Immersive Ultrawide Experience

        The ViewPro UltraWide 34" features a **3440×1440 curved IPS panel** with stunning color accuracy. The 1500R curvature wraps your field of vision for an immersive experience whether you're working or gaming.

        ### Display Quality
        - **3440×1440** UWQHD resolution
        - **IPS panel** with 98% DCI-P3 coverage
        - **HDR400** with local dimming
        - **1ms GtG** response time
        - **165Hz** refresh rate with FreeSync Premium Pro

        ### Productivity
        - Picture-by-Picture for dual input sources
        - KVM switch for controlling 2 PCs
        - USB-C with 90W Power Delivery
        - Daisy-chain support via DisplayPort out
      MD
      price: 699.99,
      original_price: 849.99,
      category: 'Monitors',
      brand: 'ViewPro',
      sku: 'VP-UW34-CRV',
      images: [
        { url: '/seed-images/products/prod-e2bda29ae9e4.jpg', alt: 'ViewPro UltraWide 34" Monitor', position: 0 },
        { url: '/seed-images/products/prod-78549fe46ceb.jpg', alt: 'ViewPro UltraWide - Desk setup', position: 1 }
      ],
      specs: { 'Resolution' => '3440×1440 UWQHD', 'Panel' => 'IPS, 1500R Curved', 'Refresh Rate' => '165Hz', 'Response Time' => '1ms GtG', 'HDR' => 'HDR400 with local dimming', 'Color' => '98% DCI-P3', 'Ports' => 'HDMI 2.1, DP 1.4, USB-C 90W PD', 'Adaptive Sync' => 'FreeSync Premium Pro' },
      features: ['34" 1500R curved ultrawide IPS panel', '165Hz refresh rate with 1ms response', 'USB-C with 90W Power Delivery', 'Built-in KVM switch for 2 PCs', '98% DCI-P3 color accuracy', 'HDR400 with local dimming zones'],
      tags: ['ultrawide', 'curved', 'usb-c', 'hdr', 'gaming', 'productivity'],
      average_rating: 4.5,
      stock_quantity: 112
    },
    {
      name: 'ViewPro Studio 27" 4K Monitor',
      description: "Professional 27\" 4K monitor with factory-calibrated colors, 99% Adobe RGB, and Thunderbolt 3 docking. Ideal for photo and video editing.",
      price: 1099.99,
      original_price: nil,
      category: 'Monitors',
      brand: 'ViewPro',
      sku: 'VP-STD27-4K',
      images: [{ url: '/seed-images/products/prod-0a599bec54d9.jpg', alt: 'ViewPro Studio 27" 4K', position: 0 }],
      specs: { 'Resolution' => '3840×2160 4K', 'Panel' => 'IPS', 'Color' => '99% Adobe RGB, Delta E < 1', 'Ports' => 'Thunderbolt 3, HDMI 2.0, DP 1.4', 'Calibration' => 'Factory calibrated' },
      features: ['99% Adobe RGB with Delta E < 1', 'Factory calibrated for accuracy', 'Thunderbolt 3 with daisy chain', 'Hardware LUT calibration'],
      tags: ['4k', 'professional', 'color-accurate', 'thunderbolt', 'photo-editing'],
      average_rating: 4.7,
      stock_quantity: 64
    },

    # === Chargers & Power ===
    {
      name: 'PowerMax GaN 140W USB-C Charger',
      description: <<~MD,
        ## Charge Everything, Everywhere

        The PowerMax GaN 140W is a **compact 4-port charger** that can power your laptop, tablet, and two phones simultaneously. GaN III technology delivers maximum power in a size 40% smaller than traditional silicon chargers.

        ### Ports & Power
        - **USB-C 1:** 140W PD 3.1 (laptop fast charge)
        - **USB-C 2:** 100W PD 3.0
        - **USB-C 3:** 30W PD
        - **USB-A:** 22.5W QC 4.0

        Total output: 140W with intelligent power distribution.

        ### Safety
        - GaN III with ActiveShield 2.0
        - Multi-protect 10-point safety system
        - ETL, FCC, CE certified
        - 30-month warranty
      MD
      price: 79.99,
      original_price: 99.99,
      category: 'Chargers',
      brand: 'PowerMax',
      sku: 'PM-GAN140',
      images: [{ url: '/seed-images/products/prod-cedfeb3a6e1a.jpg', alt: 'PowerMax GaN 140W Charger', position: 0 }],
      specs: { 'Total Power' => '140W', 'Ports' => '3× USB-C + 1× USB-A', 'Technology' => 'GaN III', 'USB-C 1' => '140W PD 3.1', 'USB-C 2' => '100W PD 3.0', 'USB-C 3' => '30W PD', 'USB-A' => '22.5W QC 4.0', 'Weight' => '240g' },
      features: ['140W total output with GaN III', '4 ports: 3× USB-C + 1× USB-A', 'PD 3.1 for fast laptop charging', '40% smaller than silicon chargers', 'ActiveShield 2.0 temperature control'],
      tags: ['charger', 'usb-c', 'gan', 'fast-charge', 'travel', 'multi-port'],
      average_rating: 4.5,
      stock_quantity: 456
    },
    {
      name: 'PowerMax Wireless Charging Pad Duo',
      description: "Dual wireless charging pad for phone and earbuds/watch. Supports 15W Qi2 fast charge with magnetic alignment.",
      price: 49.99,
      original_price: 59.99,
      category: 'Chargers',
      brand: 'PowerMax',
      sku: 'PM-WCDUO',
      images: [{ url: '/seed-images/products/prod-3838ae96e2ee.jpg', alt: 'PowerMax Wireless Charging Pad', position: 0 }],
      specs: { 'Primary Pad' => '15W Qi2', 'Secondary Pad' => '5W', 'Input' => 'USB-C 30W', 'Material' => 'Leather + Aluminum' },
      features: ['15W Qi2 magnetic fast charging', 'Dual charging for phone and accessories', 'LED indicator with sleep-friendly dimming', 'Premium leather and aluminum design'],
      tags: ['wireless-charging', 'qi2', 'magnetic', 'dual', 'desk-accessory'],
      average_rating: 4.2,
      stock_quantity: 378
    },

    # === Audio Accessories ===
    {
      name: 'ProSound Wireless Audio Transmitter',
      description: "Bluetooth 5.3 audio transmitter with aptX Adaptive for adding wireless capability to any audio source. Supports dual headphone connection.",
      price: 39.99,
      original_price: nil,
      category: 'Accessories',
      brand: 'ProSound',
      sku: 'PS-WAT-BT53',
      images: [{ url: '/seed-images/products/prod-70dd39b39275.jpg', alt: 'ProSound Wireless Transmitter', position: 0 }],
      specs: { 'Bluetooth' => '5.3', 'Codecs' => 'aptX Adaptive, AAC, SBC', 'Range' => '30m', 'Battery' => '20 hours', 'Input' => '3.5mm / optical / USB' },
      features: ['Bluetooth 5.3 with aptX Adaptive', 'Dual headphone connection', '20-hour battery life', 'Multiple input options'],
      tags: ['bluetooth', 'transmitter', 'wireless', 'audio', 'adapter'],
      average_rating: 4.1,
      stock_quantity: 267
    },

    # === Drones ===
    {
      name: 'SkyVision Pro 4K Drone',
      description: <<~MD,
        ## Aerial Photography Redefined

        The SkyVision Pro delivers **cinema-grade 4K footage** with a Hasselblad camera system and omnidirectional obstacle sensing. Whether you're a professional filmmaker or an enthusiastic hobbyist, this drone opens up new creative possibilities.

        ### Camera System
        - **1" CMOS sensor** with Hasselblad color science
        - **5.1K/50fps** and **4K/120fps** video
        - **20MP DNG RAW** photos
        - **10-bit D-Log M** color profile

        ### Flight Performance
        - **46 minutes** max flight time
        - **21 km** max transmission range
        - **O3+** triple-antenna transmission
        - **Max speed:** 75 km/h (Sport mode)

        ### Safety
        - Omnidirectional obstacle sensing
        - Advanced Return-to-Home
        - ADS-B aircraft detection
        - GEO 2.0 geofencing
      MD
      price: 1599.99,
      original_price: 1799.99,
      category: 'Drones',
      brand: 'SkyVision',
      sku: 'SV-PRO4K',
      images: [
        { url: '/seed-images/products/prod-6036a300ebb6.jpg', alt: 'SkyVision Pro 4K Drone', position: 0 },
        { url: '/seed-images/products/prod-df27beb7a427.jpg', alt: 'SkyVision Pro - In flight', position: 1 }
      ],
      specs: { 'Camera' => '1" CMOS 20MP', 'Video' => '5.1K/50fps, 4K/120fps', 'Flight Time' => '46 minutes', 'Range' => '21 km', 'Speed' => '75 km/h', 'Obstacle Sensing' => 'Omnidirectional', 'Weight' => '895g', 'Color Science' => 'Hasselblad' },
      features: ['Hasselblad camera with 1" CMOS sensor', '46-minute max flight time', 'Omnidirectional obstacle avoidance', 'O3+ transmission up to 21km', '5.1K/50fps and 4K/120fps video', 'ActiveTrack 5.0 subject tracking'],
      tags: ['drone', 'aerial-photography', '4k-video', 'hasselblad', 'obstacle-avoidance', 'professional'],
      average_rating: 4.6,
      stock_quantity: 38
    },
    {
      name: 'SkyVision Mini SE Drone',
      description: "Ultra-lightweight 249g drone with 2.7K video and 30-minute flight time. No registration required in most countries. Perfect entry-level drone.",
      price: 299.99,
      original_price: 349.99,
      category: 'Drones',
      brand: 'SkyVision',
      sku: 'SV-MINISE',
      images: [{ url: '/seed-images/products/prod-78e10a360a9e.jpg', alt: 'SkyVision Mini SE', position: 0 }],
      specs: { 'Camera' => '1/2.3" CMOS 12MP', 'Video' => '2.7K/30fps', 'Flight Time' => '30 minutes', 'Range' => '10 km', 'Weight' => '249g' },
      features: ['Under 249g — no registration required', '2.7K video recording', '30-minute flight time', '10km transmission range'],
      tags: ['drone', 'lightweight', 'beginner', 'portable', '2.7k-video'],
      average_rating: 4.3,
      stock_quantity: 187
    },

    # === Networking ===
    {
      name: 'NetGear MeshPro Wi-Fi 7 Router',
      description: <<~MD,
        ## Next-Gen Home Networking

        The NetGear MeshPro is a **tri-band Wi-Fi 7** mesh router system delivering speeds up to **33 Gbps**. With 320MHz channels and Multi-Link Operation (MLO), it's ready for the future of home connectivity.

        ### Wi-Fi 7 Technology
        - **Tri-band:** 2.4GHz + 5GHz + 6GHz
        - **320MHz channels** on 6GHz band
        - **4K-QAM** for 20% more throughput
        - **MLO** for simultaneous multi-band connections

        ### Coverage
        - Covers up to **7,500 sq ft**
        - Supports **200+ devices**
        - Dedicated backhaul for mesh nodes
        - AI-powered traffic optimization
      MD
      price: 499.99,
      original_price: 599.99,
      category: 'Networking',
      brand: 'NetGear',
      sku: 'NG-MP-WIFI7',
      images: [{ url: '/seed-images/products/prod-fea535372937.jpg', alt: 'NetGear MeshPro Router', position: 0 }],
      specs: { 'Standard' => 'Wi-Fi 7 (802.11be)', 'Speed' => 'Up to 33 Gbps', 'Bands' => 'Tri-band (2.4 + 5 + 6 GHz)', 'Coverage' => '7,500 sq ft', 'Ethernet' => '1× 10GbE + 4× 2.5GbE', 'Processor' => 'Quad-core 2.6 GHz' },
      features: ['Wi-Fi 7 with 320MHz channels', 'Tri-band with 6GHz support', '10 Gigabit Ethernet port', 'Covers 7,500 sq ft', 'AI-powered traffic management', 'WPA3 enterprise security'],
      tags: ['wifi-7', 'mesh', 'router', 'tri-band', 'high-speed', '10gbe'],
      average_rating: 4.4,
      stock_quantity: 98
    },

    # === Gaming Accessories ===
    {
      name: 'GameForce Phantom Wireless Gaming Mouse',
      description: "Ultra-lightweight 58g wireless gaming mouse with 30K DPI sensor, 0.2ms click latency, and 80-hour battery. The choice of esports professionals.\n\n### Technical Details\n- PAW3950 optical sensor\n- 30,000 DPI / 750 IPS\n- Optical switches rated 100M clicks\n- 4KHz polling rate (wired)",
      price: 149.99,
      original_price: 169.99,
      category: 'Gaming',
      brand: 'GameForce',
      sku: 'GF-PHNT-WH',
      images: [
        { url: '/seed-images/products/prod-0d1d4ba19cda.jpg', alt: 'GameForce Phantom Mouse', position: 0 }
      ],
      specs: { 'Sensor' => 'PAW3950 30K DPI', 'Weight' => '58g', 'Battery' => '80 hours', 'Polling Rate' => '4KHz (wired) / 1KHz (wireless)', 'Switches' => 'Optical, 100M click durability', 'Connectivity' => '2.4GHz / Bluetooth / USB-C' },
      features: ['58g ultra-lightweight design', '30,000 DPI PAW3950 sensor', '0.2ms click latency optical switches', '80-hour wireless battery life', '4KHz polling rate in wired mode'],
      tags: ['gaming', 'mouse', 'wireless', 'esports', 'lightweight', 'high-dpi'],
      average_rating: 4.5,
      stock_quantity: 234
    },
    {
      name: 'GameForce RGB Desk Mat XXL',
      description: "Extended RGB desk mat covering your full desktop. Water-resistant micro-weave surface with non-slip rubber base. 900×400mm with 16.8M color RGB edge lighting.",
      price: 39.99,
      original_price: 49.99,
      category: 'Gaming',
      brand: 'GameForce',
      sku: 'GF-DMAT-XXL',
      images: [{ url: '/seed-images/products/prod-9f76181a80da.jpg', alt: 'GameForce RGB Desk Mat', position: 0 }],
      specs: { 'Size' => '900 × 400 × 4mm', 'Surface' => 'Micro-weave cloth', 'Base' => 'Non-slip rubber', 'RGB' => '16.8M colors, 12 effects', 'Power' => 'USB-C' },
      features: ['900×400mm full-desk coverage', '16.8M color RGB edge lighting', 'Water-resistant micro-weave surface', 'Non-slip rubber base'],
      tags: ['gaming', 'desk-mat', 'rgb', 'desk-accessory', 'water-resistant'],
      average_rating: 4.2,
      stock_quantity: 567
    },

    # === Cables ===
    {
      name: 'CablePro Thunderbolt 4 Cable 2m',
      description: "Premium braided Thunderbolt 4 cable supporting 40Gbps data, 8K display output, and 100W charging. Universal USB-C compatibility.",
      price: 49.99,
      original_price: nil,
      category: 'Cables',
      brand: 'CablePro',
      sku: 'CP-TB4-2M',
      images: [{ url: '/seed-images/products/prod-52359cc7abd1.jpg', alt: 'CablePro Thunderbolt 4 Cable', position: 0 }],
      specs: { 'Standard' => 'Thunderbolt 4 / USB4', 'Length' => '2 meters', 'Data Speed' => '40 Gbps', 'Video' => '8K@60Hz / dual 4K@60Hz', 'Power' => '100W PD', 'Material' => 'Braided nylon' },
      features: ['40 Gbps data transfer', '100W Power Delivery', '8K display output', 'Braided nylon construction'],
      tags: ['cable', 'thunderbolt', 'usb-c', 'high-speed', 'braided'],
      average_rating: 4.4,
      stock_quantity: 789
    },

    # === Audio (more) ===
    {
      name: 'SoundWave AirPod Max Clone',
      description: "Premium over-ear wireless headphones with computational audio, spatial audio with head tracking, and a breathable knit mesh canopy headband.",
      price: 399.99,
      original_price: nil,
      category: 'Headphones',
      brand: 'SoundWave',
      sku: 'SW-OE-PRMX',
      images: [{ url: '/seed-images/products/prod-8c9dd58ee973.jpg', alt: 'SoundWave Premium Over-ear', position: 0 }],
      specs: { 'Type' => 'Over-ear Wireless', 'Driver' => '40mm Dynamic', 'Battery' => '20 hours', 'ANC' => 'Computational Audio', 'Spatial' => 'With head tracking', 'Weight' => '384g' },
      features: ['Computational audio processing', 'Spatial audio with head tracking', 'Breathable knit mesh headband', 'Digital Crown for controls'],
      tags: ['premium', 'wireless', 'anc', 'spatial-audio', 'computational'],
      average_rating: 4.3,
      stock_quantity: 112
    },

    # === Smart Home ===
    {
      name: 'SmartNest Hub Display 10"',
      description: <<~MD,
        ## Your Smart Home Command Center

        The SmartNest Hub is a **10.1" smart display** with a vibrant touchscreen that serves as the command center for your smart home. Control lights, locks, cameras, and thermostats — all from one beautiful interface.

        ### Features
        - **10.1" HD touchscreen** with ambient light sensor
        - **Stereo speakers** with passive radiator for room-filling sound
        - **Smart home dashboard** for 100+ compatible brands
        - **Video calling** with 5MP wide-angle camera
        - **Digital photo frame** mode with Google Photos integration
        - **YouTube, Netflix, Spotify** streaming built-in

        ### Privacy
        Physical camera shutter switch and microphone disconnect button.
      MD
      price: 199.99,
      original_price: 229.99,
      category: 'Smart Home',
      brand: 'SmartNest',
      sku: 'SN-HUB10',
      images: [
        { url: '/seed-images/products/prod-0e6fd53f4bff.jpg', alt: 'SmartNest Hub Display', position: 0 }
      ],
      specs: { 'Display' => '10.1" HD IPS Touchscreen', 'Speakers' => 'Dual stereo + passive radiator', 'Camera' => '5MP wide-angle', 'Connectivity' => 'Wi-Fi 6, Bluetooth 5.2, Zigbee, Thread', 'Smart Home' => '100+ brands compatible', 'Weight' => '1.05 kg' },
      features: ['10.1" HD touchscreen display', 'Smart home hub with Zigbee and Thread', 'Stereo speakers with room-filling sound', 'Video calling with 5MP camera', 'Physical privacy shutter', 'Digital photo frame with Google Photos'],
      tags: ['smart-home', 'display', 'voice-assistant', 'hub', 'touchscreen', 'video-calling'],
      average_rating: 4.3,
      stock_quantity: 234
    },
    {
      name: 'SmartNest Security Camera Pro',
      description: "Indoor/outdoor security camera with 2K HDR, color night vision, and on-device AI person/package/vehicle detection. No subscription required for basic features.",
      price: 129.99,
      original_price: 149.99,
      category: 'Smart Home',
      brand: 'SmartNest',
      sku: 'SN-CAMP-OUT',
      images: [{ url: '/seed-images/products/prod-90d199a93b4a.jpg', alt: 'SmartNest Security Camera', position: 0 }],
      specs: { 'Resolution' => '2K HDR', 'Night Vision' => 'Color (starlight sensor)', 'AI Detection' => 'Person, package, vehicle, animal', 'Weather Rating' => 'IP67', 'Storage' => 'microSD + cloud optional', 'Power' => 'Wired or battery' },
      features: ['2K HDR with color night vision', 'On-device AI detection', 'IP67 weather resistance', 'No subscription for basic features'],
      tags: ['security', 'camera', 'smart-home', 'outdoor', 'ai-detection', 'night-vision'],
      average_rating: 4.4,
      stock_quantity: 345
    },

    # === Phone Accessories ===
    {
      name: 'ProShield MagSafe Case for Phone 16 Pro',
      description: "Military-grade protection with built-in MagSafe ring. Clear back with anti-yellowing coating showcases your phone's design while keeping it safe.",
      price: 49.99,
      original_price: nil,
      category: 'Phone Accessories',
      brand: 'ProShield',
      sku: 'PSH-MS16P-CLR',
      images: [{ url: '/seed-images/products/prod-97c192dd0cfc.jpg', alt: 'ProShield MagSafe Case', position: 0 }],
      specs: { 'Protection' => 'MIL-STD-810H (10ft drop)', 'MagSafe' => 'Built-in ring, 1500g hold', 'Material' => 'TPU + Polycarbonate', 'Coating' => 'Anti-yellowing', 'Compatibility' => 'Phone 16 Pro' },
      features: ['Military-grade 10ft drop protection', 'Built-in MagSafe with strong hold', 'Anti-yellowing clear back', 'Raised edges for camera and screen'],
      tags: ['phone-case', 'magsafe', 'protective', 'clear', 'military-grade'],
      average_rating: 4.3,
      stock_quantity: 1234
    },

    # === More diverse products ===
    {
      name: 'FitBand Pro Running Earbuds',
      description: "Open-ear bone conduction headphones for running. Stay aware of your surroundings while enjoying music with IP68 waterproofing and 8-hour battery.",
      price: 129.99,
      original_price: 149.99,
      category: 'Headphones',
      brand: 'FitBand',
      sku: 'FB-BCRUN',
      images: [{ url: '/seed-images/products/prod-523f15e2c426.jpg', alt: 'FitBand Bone Conduction Earbuds', position: 0 }],
      specs: { 'Type' => 'Bone Conduction', 'Battery' => '8 hours', 'Water Resistance' => 'IP68', 'Bluetooth' => '5.3', 'Weight' => '29g' },
      features: ['Open-ear bone conduction design', 'IP68 fully waterproof', '8-hour battery life', '29g ultralight weight'],
      tags: ['running', 'bone-conduction', 'waterproof', 'open-ear', 'sport'],
      average_rating: 4.2,
      stock_quantity: 189
    },
    {
      name: 'DataVault NAS Pro 4-Bay',
      description: "4-bay network attached storage with Intel Celeron J4125, 4GB DDR4, and dual 2.5GbE ports. Perfect for home media server, backup, and surveillance.",
      price: 449.99,
      original_price: 499.99,
      category: 'Storage',
      brand: 'DataVault',
      sku: 'DV-NAS4-PRO',
      images: [{ url: '/seed-images/products/prod-2fc964503d75.jpg', alt: 'DataVault NAS Pro', position: 0 }],
      specs: { 'Bays' => '4 × 3.5"/2.5"', 'CPU' => 'Intel J4125 4-core', 'RAM' => '4GB DDR4 (expandable 8GB)', 'Network' => 'Dual 2.5GbE', 'USB' => '2× USB 3.2', 'Max Capacity' => '72TB' },
      features: ['4-bay hot-swappable drive bays', 'Dual 2.5GbE networking', 'Docker and VM support', 'Automatic cloud backup sync'],
      tags: ['nas', 'storage', 'backup', 'network', 'media-server', 'raid'],
      average_rating: 4.5,
      stock_quantity: 67
    },
    {
      name: 'ClearView AR Glasses Gen 2',
      description: <<~MD,
        ## See the Future

        ClearView AR Glasses Gen 2 bring **augmented reality** into everyday life. Lightweight titanium frames with prescription lens compatibility make these glasses you'll actually want to wear all day.

        ### Features
        - **MicroLED display** with 50° FOV
        - **Spatial computing** with hand tracking
        - **Camera:** 12MP ultra-wide for spatial photos/video
        - **Audio:** Open-ear directional speakers
        - **Battery:** 4 hours continuous AR, 12 hours standby
        - **Weight:** 42g — feels like regular glasses
      MD
      price: 999.99,
      original_price: nil,
      category: 'Wearables',
      brand: 'ClearView',
      sku: 'CV-ARG2-TT',
      images: [{ url: '/seed-images/products/prod-70dd39b39275.jpg', alt: 'ClearView AR Glasses', position: 0 }],
      specs: { 'Display' => 'MicroLED 50° FOV', 'Camera' => '12MP ultra-wide', 'Audio' => 'Open-ear directional', 'Battery' => '4 hrs AR / 12 hrs standby', 'Weight' => '42g', 'Frame' => 'Titanium, prescription compatible' },
      features: ['MicroLED display with 50° field of view', 'Hand tracking spatial computing', '12MP camera for spatial photos', '42g lightweight titanium frame', 'Prescription lens compatible'],
      tags: ['ar', 'augmented-reality', 'wearable', 'smart-glasses', 'spatial-computing'],
      average_rating: 4.1,
      stock_quantity: 23
    }
  ].freeze

  class << self
    def seed!
      puts "\nSeeding additional products for search demo..."

      ADDITIONAL_PRODUCTS.each do |attrs|
        review_count = attrs.delete(:review_count) || 0
        avg_rating = attrs.delete(:average_rating) || 4.0

        product = Product.find_or_create_by!(sku: attrs[:sku]) do |p|
          p.assign_attributes(attrs.merge(average_rating: avg_rating, review_count: review_count))
        end

        # Update tags if product already existed
        if product.tags.blank? && attrs[:tags].present?
          product.update!(tags: attrs[:tags])
        end
      end

      # Also update existing products with tags
      update_existing_product_tags

      puts "Total products: #{Product.count}"
      seed_reviews_for_new_products
      puts "Total product reviews: #{ProductReview.count}"
    end

    private

    def update_existing_product_tags
      {
        'PS-EX1-BLK' => ['wireless', 'anc', 'premium', 'bluetooth', 'hi-res-audio', 'over-ear'],
        'PS-SF-BLK' => ['wireless', 'sport', 'waterproof', 'earbuds', 'fitness'],
        'PS-SMP-SLV' => ['studio', 'professional', 'wired', 'monitoring', 'over-ear'],
        'AT-BMP500' => ['wireless', 'bass', 'over-ear', 'bluetooth', 'foldable'],
        'SW-CL700' => ['wireless', 'anc', 'premium', 'over-ear', 'graphene'],
        'PS-TCP' => ['case', 'travel', 'protection', 'headphone-accessory'],
        'PS-DAC-C' => ['dac', 'usb-c', 'hi-res-audio', 'portable', 'audiophile'],
        'NB-PANC' => ['wireless', 'anc', 'colorful', 'youth', 'budget'],
        'PS-REP-ELT' => ['replacement', 'ear-pads', 'comfort', 'headphone-accessory'],
        'AT-SP360' => ['gaming', 'surround-sound', 'rgb', 'detachable-mic', 'over-ear']
      }.each do |sku, tags|
        product = Product.find_by(sku: sku)
        product&.update!(tags: tags) if product&.tags.blank?
      end
    end

    def seed_reviews_for_new_products
      products_without_reviews = Product.left_joins(:product_reviews)
                                        .group(:id)
                                        .having('COUNT(product_reviews.id) = 0')
                                        .to_a

      return if products_without_reviews.empty?

      puts "Seeding reviews for #{products_without_reviews.size} new products..."

      review_comments = {
        5 => [
          "Absolutely love this product! Exceeded all my expectations. Build quality is outstanding and it works perfectly.",
          "Best purchase I've made this year. The quality and attention to detail is remarkable. Highly recommend!",
          "Five stars all the way! This is exactly what I was looking for. Performance is incredible.",
          "Couldn't be happier. Works flawlessly right out of the box. The design is beautiful too.",
          "This is a premium product that delivers premium results. Worth every penny spent."
        ],
        4 => [
          "Really solid product overall. A few minor things could be improved but I'm very satisfied.",
          "Great value for the price. Does everything it should and then some. Would recommend.",
          "Very happy with this purchase. The build quality is impressive and it performs well.",
          "Good product with some nice features. Minor improvements could make it perfect.",
          "Solid 4 stars. Does what it promises and does it well. Small details could be better."
        ],
        3 => [
          "It's okay. Nothing special but nothing terrible either. Gets the job done.",
          "Decent product for the price but I expected a bit more. Average performance.",
          "Has its pros and cons. Works fine for basic use but falls short for advanced needs.",
          "Acceptable quality. Does what it's supposed to do but doesn't stand out.",
          "Middle of the road product. If you're on a budget it's fine, otherwise look elsewhere."
        ],
        2 => [
          "Disappointed with the quality. Expected much better at this price point.",
          "Below expectations. Had several issues from the start. Would look at alternatives.",
          "Not great. The build quality feels cheap and performance is mediocre.",
          "Having buyer's remorse. There are better options available for less money.",
          "Would not purchase again. Quality control seems lacking on this product."
        ],
        1 => [
          "Complete waste of money. Broke within the first week of use.",
          "Terrible product. Nothing works as advertised. Returning immediately.",
          "Worst purchase I've ever made. Save your money and buy something else.",
          "Do not buy this. Quality is awful and customer support is non-existent.",
          "Defective out of the box. The worst product experience I've had."
        ]
      }

      titles = {
        5 => ['Amazing!', 'Perfect product', 'Exceeded expectations', 'Absolutely love it', 'Best purchase ever'],
        4 => ['Very good', 'Solid product', 'Happy with purchase', 'Good quality', 'Recommended'],
        3 => ['It is okay', 'Average', 'Decent', 'Gets the job done', 'Nothing special'],
        2 => ['Disappointed', 'Below expectations', 'Not recommended', 'Could be better', 'Underwhelming'],
        1 => ['Terrible', 'Waste of money', 'Do not buy', 'Awful quality', 'Return immediately']
      }

      first_names = %w[James Mary Robert Patricia John Jennifer Michael Linda David Elizabeth Sarah Thomas Christopher Karen Daniel Nancy Matthew Betty Anthony Sandra Alex Morgan Casey Jordan Taylor Riley Quinn Avery Harper Peyton]
      last_names = %w[Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Wilson Anderson Taylor Thomas Moore Jackson Martin Lee Thompson White Harris Clark Lewis Robinson Walker Young Allen King Wright]

      products_without_reviews.each do |product|
        reviews_count = rand(200..800)
        batch = reviews_count.times.map do
          rating = weighted_random_rating
          fname = first_names.sample
          lname = last_names.sample
          {
            product_id: product.id,
            rating: rating,
            title: titles[rating].sample,
            comment: review_comments[rating].sample,
            reviewer_name: "#{fname} #{lname[0]}.",
            verified_purchase: rand < 0.65,
            helpful_count: rating >= 4 ? rand(0..80) : rand(0..15),
            created_at: rand(365).days.ago,
            updated_at: Time.current
          }
        end

        # Insert in batches via SQL for speed
        batch.each_slice(500) do |slice|
          values = slice.map do |r|
            conn = ActiveRecord::Base.connection
            "(#{r[:product_id]}, #{r[:rating]}, " \
              "#{conn.quote(r[:title])}, #{conn.quote(r[:comment])}, " \
              "#{conn.quote(r[:reviewer_name])}, #{r[:verified_purchase]}, " \
              "#{r[:helpful_count]}, '#{r[:created_at].to_fs(:db)}', '#{r[:updated_at].to_fs(:db)}')"
          end.join(",\n")

          ActiveRecord::Base.connection.execute(<<~SQL)
            INSERT INTO product_reviews
              (product_id, rating, title, comment, reviewer_name, verified_purchase, helpful_count, created_at, updated_at)
            VALUES #{values}
          SQL
        end

        product.update_cached_rating!
      end
    end

    def weighted_random_rating
      r = rand
      if r < 0.40 then 5
      elsif r < 0.65 then 4
      elsif r < 0.80 then 3
      elsif r < 0.92 then 2
      else 1
      end
    end
  end
end
