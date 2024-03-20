#!/usr/bin/env bash

# This script is based on Bun (https://github.com/oven-sh/bun)
# https://github.com/oven-sh/bun/blob/main/src/cli/install.sh
# MIT License

set -euo pipefail

# Reset
Color_Off=''

# Regular Colors
Red=''
Green=''
Dim='' # White

# Bold
Bold_White=''
Bold_Green=''

if [[ -t 1 ]]; then
    # Reset
    Color_Off='\033[0m' # Text Reset

    # Regular Colors
    Red='\033[0;31m'   # Red
    Green='\033[0;32m' # Green
    Dim='\033[0;2m'    # White

    # Bold
    Bold_Green='\033[1;32m' # Bold Green
    Bold_White='\033[1m'    # Bold White
fi

error() {
    echo -e "${Red}error${Color_Off}:" "$@" >&2
    exit 1
}

info() {
    echo -e "${Dim}$@ ${Color_Off}"
}

info_bold() {
    echo -e "${Bold_White}$@ ${Color_Off}"
}

success() {
    echo -e "${Green}$@ ${Color_Off}"
}

command -v xz >/dev/null ||
    error 'xz is required to install qlty'

if [[ $# -gt 0 ]]; then
    error 'Too many arguments, none are allowed'
fi

# Hardcoding the asset_id for now, which means this will always install a specific
# version of qlty, rather than the latest
# 
# This is a workaround because the qltyai/qlty repository is currently private,
# which means the only way to download assets is using the GitHub API, rather than
# browser downlaod URLs.
#
# In theory, we could lookup the asset_id for the latest release by querying the API.
# However, this would require parsing and searching through JSON output, and I don't
# know of a good universally portable way to do that without requiring/installing
# additional software. (macOS no longer ships with python.)
# 
# So we settle for this for now, and after installation users can do `qlty upgrade`
case $(uname -ms) in
'Darwin x86_64')
    target=x86_64-apple-darwin
    ;;
'Darwin arm64')
    target=aarch64-apple-darwin
    ;;
# 'Linux aarch64' | 'Linux arm64')
#     target=aarch64-unknown-linux
#     ;;
'Linux x86_64' | *)
    target=x86_64-unknown-linux-gnu
    ;;
esac

if [[ $target = darwin-x64 ]]; then
    # Is this process running in Rosetta?
    # redirect stderr to devnull to avoid error message when not running in Rosetta
    if [[ $(sysctl -n sysctl.proc_translated 2>/dev/null) = 1 ]]; then
        target=darwin-aarch64
        info "Your shell is running in Rosetta 2. Downloading qlty for $target instead"
    fi
fi



exe_name=qlty

qlty_uri="https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-$target.tar.xz"

install_env=QLTY_INSTALL
bin_env=\$$install_env/bin

install_dir=$HOME/.qlty
bin_dir=$install_dir/bin
exe=$bin_dir/qlty

download_dir=$install_dir/downloads
download=$download_dir/qlty.tar.xz

if [[ ! -d $bin_dir ]]; then
    mkdir -p "$bin_dir" ||
        error "Failed to create directory \"$bin_dir\""
fi

if [[ ! -d $download_dir ]]; then
    mkdir -p "$download_dir" ||
        error "Failed to create directory \"$download_dir\""
fi

curl --fail --location --progress-bar --output "$download" "$qlty_uri" ||
    error "Failed to download qlty from \"$qlty_uri\""

tar -xpJf "$download" -C $download_dir ||
    error 'Failed to extract qlty'

mv "$download_dir/qlty-$target/$exe_name" "$exe" ||
    error 'Failed to move extracted qlty to destination'

chmod +x "$exe" ||
    error 'Failed to set permissions on qlty executable'

rm -r "$download_dir/qlty-$target" "$download"

tildify() {
    if [[ $1 = $HOME/* ]]; then
        local replacement=\~/

        echo "${1/$HOME\//$replacement}"
    else
        echo "$1"
    fi
}

success "qlty was installed successfully to $Bold_Green$(tildify "$exe")"

if command -v qlty >/dev/null; then
    # Install completions, but we don't care if it fails
    $exe completions --install &>/dev/null || :

    echo "Run 'qlty --help' to get started"
    exit
fi

refresh_command=''

tilde_bin_dir=$(tildify "$bin_dir")
quoted_install_dir=\"${install_dir//\"/\\\"}\"

if [[ $quoted_install_dir = \"$HOME/* ]]; then
    quoted_install_dir=${quoted_install_dir/$HOME\//\$HOME/}
fi

echo

case $(basename "$SHELL") in
fish)
    # Install completions, but we don't care if it fails
    SHELL=fish $exe completions --install &>/dev/null || :

    commands=(
        "set --export $install_env $quoted_install_dir"
        "set --export PATH $bin_env \$PATH"
    )

    fish_config=$HOME/.config/fish/config.fish
    tilde_fish_config=$(tildify "$fish_config")

    if [[ -w $fish_config ]]; then
        {
            echo -e '\n# qlty'

            for command in "${commands[@]}"; do
                echo "$command"
            done
        } >>"$fish_config"

        info "Added \"$tilde_bin_dir\" to \$PATH in \"$tilde_fish_config\""

        refresh_command="source $tilde_fish_config"
    else
        echo "Manually add the directory to $tilde_fish_config (or similar):"

        for command in "${commands[@]}"; do
            info_bold "  $command"
        done
    fi
    ;;
zsh)
    # Install completions, but we don't care if it fails
    SHELL=zsh $exe completions --install &>/dev/null || :

    commands=(
        "export $install_env=$quoted_install_dir"
        "export PATH=\"$bin_env:\$PATH\""
    )

    zsh_config=$HOME/.zshrc
    tilde_zsh_config=$(tildify "$zsh_config")

    if [[ -w $zsh_config ]]; then
        {
            echo -e '\n# qlty'

            for command in "${commands[@]}"; do
                echo "$command"
            done
        } >>"$zsh_config"

        info "Added \"$tilde_bin_dir\" to \$PATH in \"$tilde_zsh_config\""

        refresh_command="exec $SHELL"
    else
        echo "Manually add the directory to $tilde_zsh_config (or similar):"

        for command in "${commands[@]}"; do
            info_bold "  $command"
        done
    fi
    ;;
bash)
    # Install completions, but we don't care if it fails
    SHELL=bash $exe completions --install &>/dev/null || :

    commands=(
        "export $install_env=$quoted_install_dir"
        "export PATH=$bin_env:\$PATH"
    )

    bash_configs=(
        "$HOME/.bashrc"
        "$HOME/.bash_profile"
    )

    if [[ ${XDG_CONFIG_HOME:-} ]]; then
        bash_configs+=(
            "$XDG_CONFIG_HOME/.bash_profile"
            "$XDG_CONFIG_HOME/.bashrc"
            "$XDG_CONFIG_HOME/bash_profile"
            "$XDG_CONFIG_HOME/bashrc"
        )
    fi

    set_manually=true
    for bash_config in "${bash_configs[@]}"; do
        tilde_bash_config=$(tildify "$bash_config")

        if [[ -w $bash_config ]]; then
            {
                echo -e '\n# qlty'

                for command in "${commands[@]}"; do
                    echo "$command"
                done
            } >>"$bash_config"

            info "Added \"$tilde_bin_dir\" to \$PATH in \"$tilde_bash_config\""

            refresh_command="source $bash_config"
            set_manually=false
            break
        fi
    done

    if [[ $set_manually = true ]]; then
        echo "Manually add the directory to $tilde_bash_config (or similar):"

        for command in "${commands[@]}"; do
            info_bold "  $command"
        done
    fi
    ;;
*)
    echo 'Manually add the directory to ~/.bashrc (or similar):'
    info_bold "  export $install_env=$quoted_install_dir"
    info_bold "  export PATH=\"$bin_env:\$PATH\""
    ;;
esac

echo
info "To get started, run:"
echo

if [[ $refresh_command ]]; then
    info_bold "  $refresh_command"
fi

info_bold "  qlty --help"
