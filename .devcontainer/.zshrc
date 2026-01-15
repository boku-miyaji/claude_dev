# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load
ZSH_THEME="powerlevel10k/powerlevel10k"

# Which plugins would you like to load?
plugins=(git fzf)

source $ZSH/oh-my-zsh.sh

# Autosuggestion strategy: completion first, then history
ZSH_AUTOSUGGEST_STRATEGY=(completion history)

# Don't auto-insert first completion candidate
unsetopt MENU_COMPLETE
unsetopt AUTO_MENU

# Show list of candidates but don't insert
setopt AUTO_LIST
setopt LIST_AMBIGUOUS

# Plugin prefix for DevContainer
PLUG_PREFIX="$ZSH/custom/plugins"

# Load plugins
source $PLUG_PREFIX/zsh-autosuggestions/zsh-autosuggestions.zsh
source $PLUG_PREFIX/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Tab: accept autosuggestion if present, otherwise normal completion
_tab_accept_or_complete() {
  if [[ -n "$POSTDISPLAY" ]]; then
    zle autosuggest-accept
  else
    zle .expand-or-complete
  fi
}
zle -N _tab_accept_or_complete
bindkey '^I' _tab_accept_or_complete

# Escape route: force normal completion
bindkey '^X^I' .expand-or-complete

# History settings for devcontainer
export HISTFILE=/commandhistory/.zsh_history
export HISTSIZE=10000
export SAVEHIST=10000
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
