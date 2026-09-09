#include <WiFi.h>
#include <HTTPClient.h>

// Pinos dos sensores e bomba
const int trigPin1 = 5;
const int echoPin1 = 18;
const int trigPin2 = 19;
const int echoPin2 = 21;
const int bomba1Pin = 26;

// Wi-Fi
const char* ssid = "RecepitorXiaome";
const char* password = "arrezeb1";

// IP do servidor backend
const char* serverUrl = "http://192.168.31.176:3000";

#define SOUND_SPEED 0.034

float distanceCm1, distanceCm2;
int estadoBomba = 0; // 0 = desligada, 1 = ligada
int comandoManual = 0; // 1 se o usuário ligou via site
unsigned long lastSend = 0;
const unsigned long sendInterval = 5000;

void setup() {
  Serial.begin(115200);
  pinMode(trigPin1, OUTPUT);
  pinMode(echoPin1, INPUT);
  pinMode(trigPin2, OUTPUT);
  pinMode(echoPin2, INPUT);
  pinMode(bomba1Pin, OUTPUT);
  digitalWrite(bomba1Pin, LOW);

  WiFi.begin(ssid, password);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ Conectado!");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Lê os sensores
  distanceCm1 = lerSensor(trigPin1, echoPin1);
  distanceCm2 = lerSensor(trigPin2, echoPin2);

  float nivel1 = converterParaPorcentagem(distanceCm1);
  float nivel2 = converterParaPorcentagem(distanceCm2);

  Serial.printf("Caixa1: %.2f%% | Caixa2: %.2f%%\n", nivel1, nivel2);

  // 1️⃣ Verifica se há comando manual
  comandoManual = checarComandoBomba();

  // 2️⃣ Lógica automática
  if (comandoManual == 1) {
    // Se o usuário ligou manualmente
    if (nivel2 > 10) {
      ligarBomba();
    } else {
      desligarBomba();
    }
  } else {
    // Controle automático
    if (nivel1 < 15 && nivel2 > 15) {
      ligarBomba();
    }
    if (nivel2 < 14) {
      desligarBomba();
    }
  }

  // 3️⃣ Envia dados ao servidor a cada 5s
  if (millis() - lastSend > sendInterval) {
    enviarLeituras(nivel1, nivel2, estadoBomba);
    lastSend = millis();
  }

  delay(500);
}

// --- Funções auxiliares ---

float lerSensor(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return 0;
  return (duration * SOUND_SPEED) / 2.0;
}

// Converte cm para porcentagem (ajuste conforme altura das caixas)
float converterParaPorcentagem(float distancia) {
  const float alturaCaixa = 30.0; // Exemplo: 30 cm de altura
  float nivel = 100 - ((distancia / alturaCaixa) * 100);
  if (nivel < 0) nivel = 0;
  if (nivel > 100) nivel = 100;
  return nivel;
}

void ligarBomba() {
  if (estadoBomba == 0) {
    digitalWrite(bomba1Pin, HIGH);
    estadoBomba = 1;
    Serial.println("💧 Bomba LIGADA");
  }
}

void desligarBomba() {
  if (estadoBomba == 1) {
    digitalWrite(bomba1Pin, LOW);
    estadoBomba = 0;
    Serial.println("💤 Bomba DESLIGADA");
  }
}

void enviarLeituras(float c1, float c2, int bomba) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverUrl) + "/api/dados";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"caixa1\": " + String(c1, 2) + 
                   ", \"caixa2\": " + String(c2, 2) + 
                   ", \"bomba\": " + String(bomba) + "}";

  int httpCode = http.POST(payload);
  Serial.printf("📤 Enviando: %s -> HTTP %d\n", payload.c_str(), httpCode);
  http.end();
}

int checarComandoBomba() {
  if (WiFi.status() != WL_CONNECTED) return 0;
  HTTPClient http;
  String url = String(serverUrl) + "/api/bomba/status";
  http.begin(url);
  int httpCode = http.GET();
  int comando = 0;

  if (httpCode == 200) {
    String resp = http.getString();
    int pos = resp.indexOf("bomba");
    if (pos != -1) {
      comando = resp.substring(resp.indexOf(':', pos) + 1).toInt();
    }
  }
  http.end();
  return comando;
}
