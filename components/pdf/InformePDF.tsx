import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Caso, Paciente } from '@/lib/types';
import { AVISO_LEGAL } from '@/lib/constantes';

export interface DatosInforme {
  caso: Caso;
  paciente: Paciente;
  veterinario: { nombre: string | null; clinica: string | null };
  imagenes: string[]; // data URLs
  chat: { rol: 'user' | 'assistant'; contenido: string }[] | null;
}

const c = { teal: '#1f7b7a', gris: '#475569', borde: '#e2e8f0' };

const s = StyleSheet.create({
  pagina: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b', lineHeight: 1.4 },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: `2 solid ${c.teal}`, paddingBottom: 8, marginBottom: 14 },
  titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: c.teal },
  sub: { fontSize: 9, color: c.gris },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.teal, marginTop: 14, marginBottom: 6 },
  fila: { flexDirection: 'row', flexWrap: 'wrap' },
  dato: { width: '33%', marginBottom: 4 },
  etiqueta: { fontSize: 8, color: c.gris, textTransform: 'uppercase' },
  item: { marginLeft: 8, marginBottom: 2 },
  caja: { border: `1 solid ${c.borde}`, borderRadius: 4, padding: 8, marginBottom: 6 },
  img: { width: 150, height: 150, objectFit: 'cover', marginRight: 8, marginBottom: 8, borderRadius: 4 },
  aviso: { marginTop: 10, padding: 8, backgroundColor: '#fffbeb', border: '1 solid #fcd34d', fontSize: 8.5, color: '#78350f' },
  pie: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: c.gris, textAlign: 'center' },
  msgVet: { marginBottom: 6, padding: 6, backgroundColor: '#effbfa' },
  msgIa: { marginBottom: 6, padding: 6, border: `1 solid ${c.borde}` },
});

const Lista = ({ items }: { items: string[] }) =>
  items.length ? (
    <View>
      {items.map((t, i) => (
        <Text key={i} style={s.item}>
          • {t}
        </Text>
      ))}
    </View>
  ) : (
    <Text style={s.item}>—</Text>
  );

/** Quita la sintaxis markdown básica para el PDF. */
const plano = (t: string) => t.replace(/\*\*|__|`|^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ');

export default function InformePDF({ caso, paciente, veterinario, imagenes, chat }: DatosInforme) {
  const a = caso.analisis;
  const fecha = new Date(caso.creado_en).toLocaleDateString('es', { dateStyle: 'long' });

  return (
    <Document title={`Informe ${paciente.nombre ?? paciente.especie} - ${fecha}`}>
      <Page size="A4" style={s.pagina}>
        <View style={s.cabecera}>
          <View>
            <Text style={s.titulo}>Informe clínico</Text>
            <Text style={s.sub}>VetVision · Asistente de diagnóstico por imágenes</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text>{veterinario.clinica ?? ''}</Text>
            <Text style={s.sub}>{veterinario.nombre ? `MV ${veterinario.nombre}` : ''}</Text>
            <Text style={s.sub}>{fecha}</Text>
          </View>
        </View>

        <Text style={s.h2}>Paciente</Text>
        <View style={s.fila}>
          {[
            ['Nombre', paciente.nombre ?? '—'],
            ['Especie', paciente.especie],
            ['Edad', paciente.edad_anios != null ? `${paciente.edad_anios} años` : '—'],
            ['Peso', paciente.peso_kg != null ? `${paciente.peso_kg} kg` : '—'],
          ].map(([k, v]) => (
            <View key={k} style={s.dato}>
              <Text style={s.etiqueta}>{k}</Text>
              <Text>{v}</Text>
            </View>
          ))}
        </View>
        {caso.sintomas && (
          <View style={{ marginTop: 4 }}>
            <Text style={s.etiqueta}>Síntomas observados</Text>
            <Text>{caso.sintomas}</Text>
          </View>
        )}

        {imagenes.length > 0 && (
          <>
            <Text style={s.h2}>Imágenes</Text>
            <View style={s.fila}>
              {imagenes.map((src, i) => (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image key={i} src={src} style={s.img} />
              ))}
            </View>
          </>
        )}

        {(caso.diagnostico_final || caso.tratamiento_final || caso.notas_veterinario) && (
          <>
            <Text style={s.h2}>Diagnóstico y tratamiento del veterinario</Text>
            <View style={s.caja}>
              <Text style={s.etiqueta}>Diagnóstico final</Text>
              <Text style={{ marginBottom: 4 }}>{caso.diagnostico_final ?? '—'}</Text>
              <Text style={s.etiqueta}>Tratamiento indicado</Text>
              <Text style={{ marginBottom: 4 }}>{caso.tratamiento_final ?? '—'}</Text>
              <Text style={s.etiqueta}>Notas</Text>
              <Text>{caso.notas_veterinario ?? '—'}</Text>
            </View>
          </>
        )}

        {a && a.imagen_valida && (
          <>
            <Text style={s.h2}>Análisis de apoyo por IA</Text>
            {a.diagnostico_principal && (
              <View style={s.caja}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                  {a.diagnostico_principal.nombre} (confianza {a.diagnostico_principal.confianza}
                  {a.urgencia ? ` · urgencia: ${a.urgencia}` : ''})
                </Text>
                <Text>{a.diagnostico_principal.justificacion}</Text>
              </View>
            )}
            <Text style={s.etiqueta}>Hallazgos visuales</Text>
            <Lista items={a.hallazgos_visuales} />
            <Text style={[s.etiqueta, { marginTop: 6 }]}>Diferenciales</Text>
            <Lista items={a.diferenciales.map((d) => `${d.nombre}: ${d.justificacion}`)} />
            <Text style={[s.etiqueta, { marginTop: 6 }]}>Pruebas recomendadas</Text>
            <Lista items={a.pruebas_recomendadas} />
            <Text style={[s.etiqueta, { marginTop: 6 }]}>Tratamiento orientativo</Text>
            {a.tratamiento.general ? <Text style={s.item}>{a.tratamiento.general}</Text> : null}
            <Lista items={a.tratamiento.farmacologico} />
            <Text style={[s.etiqueta, { marginTop: 6 }]}>Cuidados en casa</Text>
            <Lista items={a.tratamiento.cuidados_casa} />
            <Text style={[s.etiqueta, { marginTop: 6 }]}>Señales de alarma</Text>
            <Lista items={a.tratamiento.senales_alarma} />
          </>
        )}

        <Text style={s.aviso}>{AVISO_LEGAL}</Text>

        {chat && chat.length > 0 && (
          <View break>
            <Text style={s.h2}>Conversación clínica con la IA</Text>
            {chat.map((m, i) => (
              <View key={i} style={m.rol === 'user' ? s.msgVet : s.msgIa} wrap>
                <Text style={s.etiqueta}>{m.rol === 'user' ? 'Veterinario' : 'IA'}</Text>
                <Text>{plano(m.contenido)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text
          style={s.pie}
          render={({ pageNumber, totalPages }) => `VetVision · Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
