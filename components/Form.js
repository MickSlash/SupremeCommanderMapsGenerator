import { useState } from "react";
import axios from 'axios';
import Swal from 'sweetalert2';
import { SERVER_FLASK } from "../lib/serverConfig";

const MAP_STYLES = [
  { value: "LAND_BRIDGE", label: "Land Bridge (Default)" },
  { value: "BASIC", label: "Basic" },
  { value: "BIG_ISLANDS", label: "Big Islands" },
  { value: "CENTER_LAKE", label: "Center Lake" },
  { value: "DROP_PLATEAU", label: "Drop Plateau" },
  { value: "FLOODED", label: "Flooded" },
  { value: "HIGH_RECLAIM", label: "High Reclaim" },
  { value: "LITTLE_MOUNTAIN", label: "Little Mountain" },
  { value: "VALLEY", label: "Valley" },
];

export default function Form({ modalStatus }) {
  const [playerNumber, setPlayerNumber] = useState("6");
  const [mapToGen, setMapToGen] = useState("1");
  const [mapSize, setMapSize] = useState("512");
  const [mapStyle, setMapStyle] = useState("LAND_BRIDGE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateMap = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    modalStatus(false);

    Swal.fire({
      title: 'Generazione in corso...',
      html: 'Il generatore Neroxis sta calcolando la topologia e le texture della mappa.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const formData = new FormData();
      formData.append("maxPlayer", playerNumber);
      formData.append("mapNumber", mapToGen);
      formData.append("mapSize", mapSize);
      formData.append("mapStyle", mapStyle);

      const response = await axios.post(`${SERVER_FLASK}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      Swal.close();
      const { data } = response;
      const maps = Array.isArray(data) && data[0]?.mappe_generate ? data[0].mappe_generate : [];

      if (!maps.length) {
        Swal.fire({
          icon: 'warning',
          title: 'Nessuna mappa generata',
          text: 'Il generatore non ha restituito mappe valide. Controlla i log del server.',
        });
        return;
      }

      if (maps.length > 1) {
        const mapsHTML = maps.map((mapData) => `
          <div style="margin-bottom: 20px; text-align: center;">
            <p style="font-weight: 600; margin-bottom: 8px;">${mapData.nome_mappa}</p>
            <img src="${mapData.immagine_mappa}" alt="${mapData.nome_mappa}" style="width: 100%; max-width: 400px; border-radius: 8px; margin: 0 auto 10px; display: block;" />
            <a href="${mapData.download_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 8px 16px; background-color: #10B981; color: white; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Scarica Mappa (.zip)
            </a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
        `).join('');

        Swal.fire({
          title: 'Mappe Generate con Successo!',
          html: `<div style="max-height: 480px; overflow-y: auto;">${mapsHTML}</div>`,
          confirmButtonText: "Chiudi",
          confirmButtonColor: "#3B82F6",
          width: '560px',
        });
      } else {
        const singleMap = maps[0];
        Swal.fire({
          title: singleMap.nome_mappa,
          imageUrl: singleMap.immagine_mappa,
          imageAlt: singleMap.nome_mappa,
          imageWidth: 400,
          imageHeight: 400,
          confirmButtonText: "Scarica Mappa (.zip)",
          showCancelButton: true,
          cancelButtonText: "Chiudi",
          confirmButtonColor: "#10B981",
          cancelButtonColor: "#6B7280",
        }).then((result) => {
          if (result.isConfirmed && singleMap.download_url) {
            window.open(singleMap.download_url, "_blank");
          }
        });
      }
    } catch (err) {
      Swal.close();
      const serverErrorMessage = err.response?.data?.error || err.message;
      Swal.fire({
        icon: 'error',
        title: 'Errore di Generazione',
        text: `Impossibile completare la generazione: ${serverErrorMessage}`,
        confirmButtonColor: "#EF4444",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={generateMap} className="p-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="team-size" className="block text-sm font-medium text-slate-700 mb-1">
            Numero Giocatori (Spawn Count):
          </label>
          <input
            type="number"
            id="team-size"
            onChange={(e) => setPlayerNumber(e.target.value)}
            min="2"
            max="16"
            value={playerNumber}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#F58A07] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="map-number" className="block text-sm font-medium text-slate-700 mb-1">
            Numero Mappe da generare:
          </label>
          <input
            type="number"
            id="map-number"
            onChange={(e) => setMapToGen(e.target.value)}
            min="1"
            max="10"
            value={mapToGen}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#F58A07] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="map-size" className="block text-sm font-medium text-slate-700 mb-1">
            Dimensioni Mappa:
          </label>
          <select
            id="map-size"
            value={mapSize}
            onChange={(e) => setMapSize(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#F58A07] focus:outline-none"
          >
            <option value="256">256 x 256 (5 km - Piccola)</option>
            <option value="512">512 x 512 (10 km - Media Standard)</option>
            <option value="1024">1024 x 1024 (20 km - Grande)</option>
          </select>
        </div>

        <div>
          <label htmlFor="map-style" className="block text-sm font-medium text-slate-700 mb-1">
            Stile Terreno:
          </label>
          <select
            id="map-style"
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#F58A07] focus:outline-none"
          >
            {MAP_STYLES.map((style) => (
              <option key={style.value} value={style.value}>
                {style.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => modalStatus(false)}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 text-sm font-semibold text-white bg-[#F58A07] hover:bg-[#d97706] disabled:opacity-50 rounded-lg shadow transition"
        >
          {isSubmitting ? "Generazione..." : "Genera Mappa"}
        </button>
      </div>
    </form>
  );
}
