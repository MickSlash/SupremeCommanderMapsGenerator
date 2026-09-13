import Link from 'next/link';

export default function CustomErrorComponent({ statusCode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white px-4">
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 text-[#F58A07]">
        {statusCode ? `Errore ${statusCode}` : "Oops! Qualcosa è andato storto."}
      </h1>
      <p className="text-lg text-slate-300 mb-8 text-center max-w-md">
        Si è verificato un errore inatteso. Riprova più tardi o torna alla pagina iniziale.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-[#F58A07] hover:bg-[#d97706] text-white font-semibold rounded-lg shadow-lg transition duration-200"
      >
        Torna alla Home
      </Link>
    </div>
  );
}

CustomErrorComponent.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};
