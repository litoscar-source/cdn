import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Match, Squad, Player } from '../types';
import { CLUB_NAME, CLUB_LOGO_URL } from '../constants';

const getDataUrl = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
           console.warn("CORS blocked canvas export", e);
           resolve('');
        }
      } else {
        resolve('');
      }
    };
    img.onerror = () => {
      console.warn("Could not load logo for PDF");
      resolve('');
    };
  });
};

export const generateConvocationPDF = async (
  match: Match, 
  squad: Squad, 
  players: Player[]
) => {
  const doc = new jsPDF();
  
  // -- Colors --
  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [30, 41, 59]; // Slate 800

  let headerOffset = 0;

  // -- Load Logo --
  const logoData = await getDataUrl(CLUB_LOGO_URL);
  if (logoData) {
    // Add logo to top left
    doc.addImage(logoData, 'PNG', 14, 15, 20, 20); // x, y, w, h
    headerOffset = 25; // Push text to the right
  }

  // -- Header --
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(CLUB_NAME, 14 + headerOffset, 22);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("Gestão de Equipas", 14 + headerOffset, 28);

  // -- Match Title --
  doc.setFontSize(18);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`CONVOCATÓRIA - ${squad.name.toUpperCase()}`, 14, 45);

  // -- Match Details --
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  let detailsY = 55;
  doc.setFont("helvetica", "bold");
  doc.text("Adversário:", 14, detailsY);
  doc.setFont("helvetica", "normal");
  doc.text(match.opponent, 40, detailsY);

  doc.setFont("helvetica", "bold");
  doc.text("Data/Hora:", 14, detailsY + 6);
  doc.setFont("helvetica", "normal");
  doc.text(`${match.date} às ${match.time}`, 40, detailsY + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Local:", 14, detailsY + 12);
  doc.setFont("helvetica", "normal");
  doc.text(match.location, 40, detailsY + 12);

  if (match.playerKit || match.goalkeeperKit) {
     detailsY += 6;
     doc.setFont("helvetica", "bold");
     doc.text("Equipamentos:", 14, detailsY + 12);
     doc.setFont("helvetica", "normal");
     let kitText = "";
     if(match.playerKit) kitText += `Jogadores: ${match.playerKit} `;
     if(match.goalkeeperKit) kitText += `| GR: ${match.goalkeeperKit}`;
     doc.text(kitText, 45, detailsY + 12);
     detailsY += 6;
  }

  // -- Players Table --
  // Sort players by jersey number
  const sortedPlayers = [...players].sort((a, b) => Number(a.jerseyNumber) - Number(b.jerseyNumber));

  const tableData = sortedPlayers.map(p => [
    p.jerseyNumber,
    p.name,
    p.jerseyName || '-'
  ]);

  autoTable(doc, {
    startY: detailsY + 20,
    head: [['#', 'Nome Completo', 'Nome Camisola']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129], // Emerald 500
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244] // Emerald 50
    }
  });
  
  // -- Notes Section --
  if (match.notes) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES:", 14, finalY);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    
    // Split text to fit page width
    const splitNotes = doc.splitTextToSize(match.notes, 180);
    doc.text(splitNotes, 14, finalY + 5);
  }

  // -- Footer --
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento gerado automaticamente por ${CLUB_NAME} Manager`, 14, pageHeight - 10);

  // -- Save File --
  const filename = `Convocatoria_${squad.name}_vs_${match.opponent.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
};