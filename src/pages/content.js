import { renderContentPage, SITE_URL, SITE_NAME } from '../templates/html.js';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  email: 'andifap80@gmail.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Balikpapan',
    addressRegion: 'Kalimantan Timur',
    addressCountry: 'ID'
  },
  description: 'Kalkulator online berbayar untuk hiburan dengan fitur ilmiah dan pembayaran digital.'
};

const pages = {
  produk: {
    title: 'Informasi Produk & Jasa',
    description: 'Pelajari layanan Kalkulator Premium: kalkulator online berbayar untuk hiburan dengan perhitungan dasar dan ilmiah.',
    path: '/produk',
    activeId: 'produk',
    h1: 'Informasi Produk/Jasa',
    bodyHtml: `
        <p><strong>Kalkulator Premium</strong> adalah kalkulator online berbayar untuk hiburan. Pengguna memasukkan rumus, melihat estimasi biaya, membayar, lalu hasil ditampilkan secara digital.</p>
        <p>Layanan mencakup perhitungan dasar dan ilmiah seperti tambah, kurang, kali, bagi, pangkat, akar, logaritma, trigonometri, persen, dan faktorial sesuai fitur aplikasi.</p>
        <p>Produk bersifat digital, instan, dan tidak dikirim dalam bentuk fisik. Sertifikat digital yang muncul setelah pembayaran adalah fitur hiburan.</p>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Layanan Kalkulator Premium',
      description: 'Kalkulator online berbayar untuk hiburan dengan perhitungan matematika dasar dan ilmiah.',
      brand: { '@type': 'Brand', name: SITE_NAME },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'IDR',
        lowPrice: '1000',
        highPrice: '100000',
        offerCount: '1'
      }
    }
  },
  tentang: {
    title: 'Tentang Kami',
    description: 'Kenali Kalkulator Premium — layanan digital ringan dan transparan untuk perhitungan matematika dengan nuansa hiburan.',
    path: '/tentang',
    activeId: 'tentang',
    h1: 'Tentang Kami',
    bodyHtml: `
        <p>Kalkulator Premium dibuat sebagai layanan digital ringan, praktis, dan interaktif untuk membantu perhitungan matematika dengan cara yang menyenangkan, serta tetap transparan dan aman dalam pembayaran.</p>
        <p>Kami menampilkan harga sebelum transaksi, memproses pembayaran melalui payment gateway resmi, dan menyediakan kontak bantuan untuk kendala transaksi.</p>
        <p>Nama Usaha/Brand: Kalkulator Premium</p>
        <p>Pemilik / Penanggung Jawab: Andi Nugraha</p>
        <p>Jenis Usaha: Usaha Perorangan (Layanan Digital Entertainment)</p>
        <p>Website Resmi: cuancrab.online</p>
        <p>Alamat Kantor Usaha: Balikpapan, Kalimantan Timur</p>`,
    jsonLd: organizationJsonLd
  },
  kontak: {
    title: 'Kontak',
    description: 'Hubungi tim Kalkulator Premium untuk pertanyaan, kendala pembayaran, atau bantuan layanan.',
    path: '/kontak',
    activeId: 'kontak',
    h1: 'Kontak',
    bodyHtml: `
        <p>Untuk pertanyaan, kendala pembayaran, atau bantuan layanan, hubungi kami melalui:</p>
        <p>Email layanan pelanggan: <a href="mailto:andifap80@gmail.com">andifap80@gmail.com</a></p>
        <p>WhatsApp/Telepon: <a href="tel:+6281254995123">+62 812-5499-5123</a></p>
        <p>Website: <a href="https://cuancrab.online">https://cuancrab.online</a></p>
        <p>Alamat Kantor Usaha: Balikpapan, Kalimantan Timur</p>
        <p>Jam operasional: Senin sampai Jumat, pukul 09.00 sampai 17.00 WIB, kecuali hari libur nasional.</p>
        <p>Sertakan nomor order, tanggal transaksi, nominal pembayaran, dan ringkasan kendala agar pengecekan lebih cepat.</p>`,
    jsonLd: {
      ...organizationJsonLd,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'andifap80@gmail.com',
        telephone: '+62-812-5499-5123',
        availableLanguage: 'Indonesian',
        hoursAvailable: 'Mo-Fr 09:00-17:00'
      }
    }
  },
  privasi: {
    title: 'Kebijakan Privasi',
    description: 'Kebijakan privasi Kalkulator Premium tentang data yang dikumpulkan, penggunaan, dan perlindungan informasi pengguna.',
    path: '/privasi',
    activeId: 'privasi',
    h1: 'Kebijakan Privasi',
    bodyHtml: `
        <p>Terakhir diperbarui: 13 Juni 2026</p>
        <p>Kami dapat memproses data rumus, nomor order, nominal pembayaran, status pembayaran, waktu transaksi, data teknis dasar, dan data kontak yang pengguna berikan saat meminta bantuan.</p>
        <p>Data digunakan untuk menjalankan layanan, memverifikasi pembayaran, memberi dukungan pelanggan, menjaga keamanan sistem, dan memenuhi kewajiban hukum.</p>
        <p>Pembayaran diproses oleh payment gateway pihak ketiga. Kami tidak menyimpan PIN, password perbankan, data kartu lengkap, atau kredensial pembayaran sensitif.</p>
        <p>Kami tidak menjual data pribadi pengguna. Data dapat dibagikan kepada payment gateway, penyedia hosting, atau pihak berwenang apabila diperlukan secara hukum.</p>`
  },
  syarat: {
    title: 'Syarat & Ketentuan',
    description: 'Syarat dan ketentuan penggunaan layanan Kalkulator Premium, termasuk pembayaran dan tanggung jawab pengguna.',
    path: '/syarat',
    activeId: 'syarat',
    h1: 'Syarat & Ketentuan',
    bodyHtml: `
        <p>Terakhir diperbarui: 13 Juni 2026</p>
        <p>Dengan menggunakan Kalkulator Premium, pengguna menyetujui bahwa layanan ini adalah layanan digital hiburan berbasis website.</p>
        <p>Harga layanan ditampilkan sebelum pembayaran. Dengan melanjutkan pembayaran, pengguna menyetujui nominal biaya yang ditampilkan. Pembayaran diproses melalui payment gateway pihak ketiga dan tunduk pada ketentuan penyedia pembayaran tersebut.</p>
        <p>Pengguna bertanggung jawab atas rumus yang dimasukkan. Hasil perhitungan wajib diperiksa kembali sebelum digunakan untuk keputusan penting.</p>
        <p>Pengguna dilarang menyalahgunakan sistem, memanipulasi harga, mengganggu payment gateway, atau melakukan aktivitas yang melanggar hukum.</p>
        <p>Kami dapat memperbarui fitur, harga, atau tampilan layanan untuk kebutuhan operasional, keamanan, dan kepatuhan.</p>`
  },
  refund: {
    title: 'Kebijakan Refund',
    description: 'Kebijakan pengembalian dana Kalkulator Premium untuk layanan digital yang sudah diproses.',
    path: '/refund',
    activeId: 'refund',
    h1: 'Kebijakan Refund/Pengembalian Dana',
    bodyHtml: `
        <p>Terakhir diperbarui: 13 Juni 2026</p>
        <p><strong>Tidak ada refund untuk layanan yang sudah berhasil diproses.</strong> Kalkulator Premium adalah layanan digital hiburan. Setelah pembayaran berhasil dan hasil perhitungan tersedia, transaksi dianggap selesai dan tidak dapat dibatalkan.</p>
        <p>Refund tidak diberikan untuk salah input rumus, salah angka, berubah pikiran, hasil yang tidak sesuai ekspektasi, atau karena kelalaian pengguna dalam memahami ketentuan simulasi.</p>
        <p>Pengecualian hanya berlaku apabila terjadi pembayaran ganda untuk order yang sama atau pembayaran berhasil tetapi hasil sama sekali tidak dapat diakses karena gangguan sistem kami.</p>
        <p>Permintaan pengecekan dapat dikirim ke <a href="mailto:andifap80@gmail.com">andifap80@gmail.com</a> maksimal 3 hari kalender sejak transaksi, dengan menyertakan nomor order, bukti pembayaran, nominal, dan tanggal transaksi.</p>`
  },
  faq: {
    title: 'FAQ',
    description: 'Pertanyaan umum tentang Kalkulator Premium: cara kerja, pembayaran, refund, dan keamanan transaksi.',
    path: '/faq',
    activeId: 'faq',
    h1: 'FAQ',
    bodyHtml: `
        <h2>Apa itu Kalkulator Premium?</h2>
        <p>Kalkulator online berbayar untuk hiburan. Masukkan rumus, bayar, lalu hasil muncul.</p>
        <h2>Apakah ini serius?</h2>
        <p>Layanannya berjalan serius dengan sistem pembayaran terintegrasi, disajikan dalam kemasan interaktif yang menghibur dan edukatif.</p>
        <h2>Apakah ada produk fisik?</h2>
        <p>Tidak. Semua digital dan langsung tampil di website.</p>
        <h2>Apakah bisa refund?</h2>
        <p>Tidak, jika hasil sudah tersedia. Refund hanya dipertimbangkan untuk pembayaran ganda atau gangguan sistem yang membuat hasil tidak bisa diakses sama sekali.</p>
        <h2>Kalau salah masukin rumus?</h2>
        <p>Itu tanggung jawab pengguna. Mohon cek rumus sebelum bayar.</p>
        <h2>Apakah pembayaran aman?</h2>
        <p>Pembayaran diproses oleh payment gateway. Kami tidak menyimpan data sensitif seperti PIN, password bank, atau data kartu lengkap.</p>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Apa itu Kalkulator Premium?',
          acceptedAnswer: { '@type': 'Answer', text: 'Kalkulator online berbayar untuk hiburan. Masukkan rumus, bayar, lalu hasil muncul.' }
        },
        {
          '@type': 'Question',
          name: 'Apakah bisa refund?',
          acceptedAnswer: { '@type': 'Answer', text: 'Tidak, jika hasil sudah tersedia. Refund hanya dipertimbangkan untuk pembayaran ganda atau gangguan sistem.' }
        },
        {
          '@type': 'Question',
          name: 'Apakah pembayaran aman?',
          acceptedAnswer: { '@type': 'Answer', text: 'Pembayaran diproses oleh payment gateway. Kami tidak menyimpan data sensitif seperti PIN atau data kartu lengkap.' }
        }
      ]
    }
  }
};

export function getContentPage(slug) {
  const page = pages[slug];
  if (!page) return null;
  return renderContentPage(page);
}