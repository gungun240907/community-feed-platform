import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { SocketProvider } from '../context/SocketContext';
import { I18nProvider } from '../context/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import Layout from '../components/Layout';

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function App({ Component, pageProps }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <AuthProvider>
        <NotificationProvider>
          <SocketProvider>
            <I18nProvider>
              <ThemeProvider>
                <Layout>
                  <Component {...pageProps} />
                </Layout>
              </ThemeProvider>
            </I18nProvider>
          </SocketProvider>
        </NotificationProvider>
      </AuthProvider>
    </>
  );
}
