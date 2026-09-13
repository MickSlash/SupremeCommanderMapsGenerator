import Head from 'next/head';
import Image from 'next/image';
import PocketBase from 'pocketbase';
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal.js';
import { Righteous } from '@next/font/google';
import { SERVER_DATA } from 'lib/serverConfig';

const FONT_STYLE = Righteous({ subsets: ['latin'], weight: '400' });
const pb = new PocketBase(SERVER_DATA);

export default function Home({ data = [] }) {
  const [mapList, setMapList] = useState([...data]);

  useEffect(() => {
    let isMounted = true;

    // Realtime subscription to PocketBase events
    pb.collection('supremecommandermaps')
      .subscribe('*', ({ action, record }) => {
        if (action === 'create' && isMounted) {
          const imageUrl = pb.getFileUrl(record, record.map_img);
          const downloadUrl = pb.getFileUrl(record, record.map_zip);
          setMapList((prev) => [
            { ...record, file_url: imageUrl, download_url: downloadUrl },
            ...prev,
          ]);
        }
      })
      .catch((err) => {
        console.warn('PocketBase realtime subscription inactive:', err.message);
      });

    return () => {
      isMounted = false;
      pb.collection('supremecommandermaps').unsubscribe('*').catch(() => {});
    };
  }, []);

  return (
    <>
      <Head>
        <title>Generatore Mappe Supreme Commander Forged Alliance</title>
        <meta
          name="description"
          content="Generatore procedurale di mappe per Supreme Commander: Forged Alliance basato su Neroxis."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
        <header className="text-center max-w-4xl mx-auto mb-8">
          <h1
            className={`${FONT_STYLE.className} text-[#F58A07] text-3xl sm:text-4xl md:text-5xl uppercase tracking-wider mb-2`}
          >
            Supreme Commander Forged Alliance
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl">
            Procedural Map Generator & Gallery
          </p>
        </header>

        <Modal />

        <section className="max-w-7xl mx-auto py-12">
          {mapList.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/60 rounded-2xl border border-slate-700 max-w-xl mx-auto">
              <p className="text-xl text-slate-300 font-medium mb-2">
                Nessuna mappa disponibile al momento.
              </p>
              <p className="text-sm text-slate-400">
                Clicca su &quot;GENERA MAPPE&quot; per generare la tua prima mappa procedurale!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
              {mapList.map((file, idx) => (
                <BlurImage key={file.id || file.map_id || idx} image={file} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function BlurImage({ image }) {
  const [isLoading, setLoading] = useState(true);

  return (
    <a
      href={image.download_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-[#F58A07] transition duration-300 shadow-lg hover:shadow-2xl"
    >
      <div className="w-full aspect-square bg-slate-700 relative overflow-hidden">
        {image.file_url ? (
          <Image
            alt={image.map_name || 'Map Preview'}
            src={image.file_url}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={cn(
              'object-cover group-hover:scale-105 duration-500 ease-in-out',
              isLoading ? 'grayscale blur-lg scale-110' : 'grayscale-0 blur-0 scale-100'
            )}
            onLoadingComplete={() => setLoading(false)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Nessuna anteprima
          </div>
        )}
      </div>
      <div className="p-4 text-center">
        <p className="text-base font-semibold text-slate-100 truncate" title={image.map_name}>
          {image.map_name}
        </p>
        <p className="mt-1 text-sm text-[#F58A07]">
          Giocatori: {image.giocatori || 'Guarda Immagine'}
        </p>
      </div>
    </a>
  );
}

export async function getServerSideProps() {
  try {
    const records = await pb.collection('supremecommandermaps').getFullList(200, {
      sort: '-created',
      $autoCancel: false,
    });

    const updatedRecords = records.map((record) => {
      const imageUrl = pb.getFileUrl(record, record.map_img);
      const downloadUrl = pb.getFileUrl(record, record.map_zip);
      return { ...record, file_url: imageUrl, download_url: downloadUrl };
    });

    return {
      props: { data: JSON.parse(JSON.stringify(updatedRecords)) },
    };
  } catch (error) {
    // Graceful fallback if database is not yet running
    return {
      props: { data: [] },
    };
  }
}
