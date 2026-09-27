import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata = {
  title: 'EduGen',
  description: 'Nền tảng dạy & học thực tế bằng AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
