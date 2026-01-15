# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time Oh My Zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="powerlevel10k/powerlevel10k"

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git)

source $ZSH/oh-my-zsh.sh

# 履歴より completion を優先（実在チェック寄り）
ZSH_AUTOSUGGEST_STRATEGY=(completion history)

# 複数候補で先頭候補を勝手に挿入しない
unsetopt MENU_COMPLETE
unsetopt AUTO_MENU

# 複数候補なら一覧表示は出す（挿入はしない）
setopt AUTO_LIST
setopt LIST_AMBIGUOUS


if command -v brew >/dev/null 2>&1; then
  PLUG_PREFIX="$(brew --prefix)/share"          # macOS: /opt/homebrew/share
else
  PLUG_PREFIX="$ZSH/custom/plugins"                     # DevContainer: ~/.oh-my-zsh/custom
fi
#----------------------------------------------------------

# Plugins
source $PLUG_PREFIX/zsh-autosuggestions/zsh-autosuggestions.zsh
# source $PLUG_PREFIX/zsh-autocomplete/zsh-autocomplete.plugin.zsh
source $PLUG_PREFIX/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Tab: 共通部分まで補完して候補一覧を表示（autosuggestionは無視）
bindkey '^I' expand-or-complete

# autosuggestionを確定したい場合は右矢印キーまたはEnd
bindkey '^[[C' autosuggest-accept   # 右矢印
bindkey '^[OC' autosuggest-accept   # 右矢印（別のターミナル）
bindkey '^E' autosuggest-accept     # Ctrl+E (End)

# History settings for devcontainer
export HISTFILE=/commandhistory/.zsh_history
export HISTSIZE=10000
export SAVEHIST=10000
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
