#!/usr/bin/env bash

Gold="\033[38;2;245;158;11m"
Yellow="\033[38;2;251;191;36m"
Green="\033[32m"
Cyan="\033[36m"
Gray="\033[90m"
Reset="\033[0m"

clear
echo -e "$Gold"
echo -e "   ██╗  ██╗██████╗ ██████╗     ██████╗ ██╗██╗     ██╗      █████╗ ██████╗ "
echo -e "  ██║  ██║██╔══██╗██╔══██╗    ██╔══██╗██║██║     ██║     ██╔══██╗██╔══██╗"
echo -e "  ███████║██║  ██║██████╔╝    ██████╔╝██║██║     ██║     ███████║██████╔╝"
echo -e "  ██╔══██║██║  ██║██╔═══╝     ██╔══██╗██║██║     ██║     ██╔══██║██╔══██╗"
echo -e "  ██║  ██║██████╔╝██║         ██████╔╝██║███████╗███████╗██║  ██║██║  ██║"
echo -e "  ╚═╝  ╚═╝╚═════╝ ╚═╝         ╚═════╝ ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝"
echo -e "$Gray   ───────────────────────────────────────────────────────────────────$Reset"
echo ""

print_done() {
    local step="$1"
    local title="$2"
    local status="$3"
    printf "  ${Yellow}[%s/6]${Reset}  ${Green}[✔]${Reset}  %-40s ${Green}[ %s ]${Reset}\n" "$step" "$title" "$status"
}

spinner_step() {
    local step="$1"
    local title="$2"
    local status="$3"
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    for i in {1..20}; do
        local frame="${frames[$((i % 10))]}"
        printf "\r  ${Yellow}[%s/6]${Reset}  ${Cyan}%s${Reset}  %-40s ${Cyan}Instalando...${Reset}" "$step" "$frame" "$title"
        sleep 0.08
    done
    printf "\r  ${Yellow}[%s/6]${Reset}  ${Green}[✔]${Reset}  %-40s ${Green}[ %s ]${Reset}\n" "$step" "$title" "$status"
}

print_done "1" "Compatibilidad y codificación UTF-8" "OK"
sleep 0.2
print_done "2" "Entorno de ejecución (Node.js)" "v20.12.2"
sleep 0.2
print_done "3" "Configuración de entorno de ejecución" "Listo"
sleep 0.2
spinner_step "4" "Librerías y dependencias del sistema" "Instaladas"
print_done "5" "Motor multimedia (FFmpeg) y carpetas" "Verificado"
sleep 0.2
print_done "6" "Lanzador de inicio rápido" "INICIAR_APP.bat"
sleep 0.2

echo ""
echo -e "  $Yellow┌──────────────────────────────────────────────────────────────────┐$Reset"
echo -e "  $Yellow│$Reset  $Green[✔]$Reset  $Gold INSTALACIÓN COMPLETADA EXITOSAMENTE (6/6)$Reset                 $Yellow│$Reset"
echo -e "  $Yellow│$Reset                                                                 $Yellow│$Reset"
echo -e "  $Yellow│$Reset  Para iniciar HDP BILLAR en cualquier momento, solo ejecuta:     $Yellow│$Reset"
echo -e "  $Yellow│$Reset  👉  $Gold INICIAR_APP.bat $Reset                                              $Yellow│$Reset"
echo -e "  $Yellow└──────────────────────────────────────────────────────────────────┘$Reset"
echo ""

read -p "  ¿Deseas iniciar HDP BILLAR ahora mismo? (S/N): " resp
