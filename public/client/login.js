Shortly.login = Backbone.View.extend({
  
  template: Templates['login'],
  
  events: {},
  
  render: () => {
    this.$el.html( this.template() );
    return this;
  },
});