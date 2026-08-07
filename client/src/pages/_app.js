import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { SocketProvider } from '../context/SocketContext';
import { I18nProvider } from '../context/I18nContext';
import Layout from '../components/Layout';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <SocketProvider>
          <I18nProvider>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </I18nProvider>
        </SocketProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
