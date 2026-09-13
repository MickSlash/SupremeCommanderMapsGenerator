import { useState } from "react";
import Form from "./Form";

export default function Modal() {
  const [showModal, setShowModal] = useState(false);
  const closeModal = () => setShowModal(false);

  return (
    <>
      <div className="flex justify-center mt-6 mb-8">
        <button
          className="bg-[#F58A07] hover:bg-[#d97706] text-white active:scale-95 font-bold uppercase text-sm sm:text-base px-8 py-3.5 rounded-xl shadow-lg hover:shadow-orange-500/20 transition-all duration-200 flex items-center gap-2"
          type="button"
          onClick={() => setShowModal(true)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Genera Nuova Mappa
        </button>
      </div>

      {showModal && (
        <>
          <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 p-4 outline-none focus:outline-none">
            <div className="relative w-full max-w-lg my-6 mx-auto">
              <div className="border border-slate-200 rounded-2xl shadow-2xl relative flex flex-col w-full bg-white outline-none focus:outline-none overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-xl font-bold text-slate-800">
                    Configurazione Mappa SCFA
                  </h3>
                  <button
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
                    onClick={() => setShowModal(false)}
                    aria-label="Chiudi finestra"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Body */}
                <Form modalStatus={closeModal} />
              </div>
            </div>
          </div>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)}></div>
        </>
      )}
    </>
  );
}
